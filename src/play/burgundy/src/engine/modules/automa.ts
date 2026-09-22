// 自动机(官方郡县卡流程,规则书 p22-28):
// 建局(牌库/翻卡/城堡/货物/修正 A-D 预填)+ 整回合执行(检索放置/收益奖励/
// 出售货物/卡填充迁移/奖励板块/黑区购买)。整回合打包为一次 Move{t:'automa'},
// 全部随机性走 GameState.rng,可重放、可联机。
import type { AutomaCard, AutomaState, GameState, PlayerState, Tile } from '../state';
import type { ModuleHook } from '../modules';
import { addVP, rewardVP, sellPerVP } from '../scoring';
import { randInt } from '../rng';
import { loadAutoma, loadBoards, type AutomaCardDef } from '../data';
import { advanceTrack } from '../flow';
import { drawTile, nextTileId } from '../setup';

export interface AutomaConfig {
  difficulty: 'easy' | 'normal' | 'hard';
  modifiers: string[];          // 'A' | 'B' | 'C' | 'D'
}

/** 储备区类型自上而下、自左而右的顺序(占位:按自动机版图 35 布局约定) */
function reserveTypeOrder(): string[] { return loadAutoma().reserveTypeOrder; }

export const automaModule: ModuleHook = {
  onSetup(g, opts) {
    if (g.playerCount < 2) throw new Error('自动机模式至少需要 1 名真实玩家');
    const cfg: AutomaConfig = opts?.automa ?? { difficulty: 'normal', modifiers: [] };
    const idx = g.playerCount - 1;
    const p = g.players[idx];
    p.isAutoma = true;
    p.name = '自动机';
    // 修正 A/B/D:使用 36 号版图(35 号背面)
    p.boardId = cfg.modifiers.some((m) => m === 'A' || m === 'B' || m === 'D') ? 36 : 35;

    const data = loadAutoma();
    const vineyard = g.modules.includes('vineyard');
    const source: AutomaCardDef[] = vineyard
      ? [data.countyCards[0], ...data.vineyardCountyCards]        // 1 + 10-17
      : data.countyCards;                                          // 1-9
    let pool: AutomaCard[] = source.map((c) => JSON.parse(JSON.stringify(c)) as AutomaCard);

    // 洗混 → 翻出含城堡格的卡放左槽(p22 设置 C)
    pool = shuffleCards(g, pool);
    const castleIdx = pool.findIndex((c) => c.cells.some((cell) => cell.castle));
    const left = pool.splice(castleIdx < 0 ? 0 : castleIdx, 1)[0];
    // 剩余洗混为牌库,顶牌放右槽(设置 D)
    const rest = shuffleCards(g, pool);
    const a: AutomaState = {
      difficulty: cfg.difficulty,
      modifiers: [...cfg.modifiers],
      deck: rest,
      cards: [left, rest.shift() ?? null],
      reserve: [],
      silver: 1,
      goods: [0, 1, 1, 1, 1, 1, 1],          // 设置 F:每色 1 个货物上货物格
      overflow: [],
      twins: [],
      shields: [],
      sellActions: 0,
    };
    // 设置 E:1 个城堡放左槽卡的城堡格
    const castleCell = left.cells.find((c) => c.castle) ?? left.cells[0];
    castleCell.filled = { id: nextTileId(), color: 'red', black: false };
    p.automa = a;
    g.log.push({ player: idx, text: `自动机:难度${a.difficulty} 修正[${a.modifiers.join('') || '无'}] 初始卡 #${left.id}/#${a.cards[1]?.id ?? '-'} 牌库${a.deck.length}` });

    prefillAB(g, p, a);

    // 顺位:自动机总是末位玩家;修正 C:第一轮起始玩家
    const others = (g.track[0] ?? []).filter((i) => i !== idx);
    g.track = [cfg.modifiers.includes('C') ? [...others, idx] : [idx, ...others]];
  },
};

function shuffleCards(g: GameState, arr: AutomaCard[]): AutomaCard[] {
  const out = [...arr];
  let r = g.rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, nr] = randInt(r, i + 1);
    r = nr;
    [out[i], out[j]] = [out[j], out[i]];
  }
  g.rng = r;
  return out;
}

/** 难度修正 A(黑面朝下)/B(彩色朝上)预填公国格(36 号版图标记格) */
function prefillAB(g: GameState, p: PlayerState, a: AutomaState) {
  if (!a.modifiers.includes('A') && !a.modifiers.includes('B')) return;
  const board = loadBoards().boards.find((b) => b.id === p.boardId);
  if (!board) return;
  let n = 0;
  for (const cell of board.cells) {
    if (cell.mark !== 'A' && cell.mark !== 'B') continue;
    const key = `${cell.r}:${cell.c}`;
    if (p.placed[key]) continue;
    const [tile, r] = drawTile(cell.color, cell.mark === 'A', g.rng, g.modules);
    g.rng = r;
    p.placed[key] = tile;
    n++;
  }
  g.log.push({ player: p.idx, text: `修正 A/B:公国预填 ${n} 格` });
}

// ================= 整回合执行 =================

const MAX_SUB = 8;      // 单回合子行动上限(城堡/额外回合连锁保护)

/** 执行自动机整回合(仅引擎经 Move{t:'automa'} 调用) */
export function executeAutomaTurn(g: GameState, player: number): void {
  const p = g.players[player];
  const a = p.automa;
  if (!a) throw new Error('玩家未初始化自动机状态');
  // 掷自动机骰(p24)
  let r = g.rng;
  const [d, r1] = randInt(r, 6);
  r = r1;
  g.rng = r;
  const die = d + 1;
  g.log.push({ player, text: `自动机:掷骰 ${die}(白骰 ${g.whiteDie} → ${g.whiteDie <= 4 ? '左' : '右'}槽)` });

  // 选择并放置 1 个六角片
  selectAndPlace(g, player, die, g.whiteDie <= 4 ? 0 : 1, 0);
  // 黑区购买(回合末,一次)
  blackPurchase(g, player);
  g.turn.used = [true, true];
}

/** 「选择并放置 1 个六角片」(p24);slot=活动卡槽;startDepot=起始检索补给区 */
function selectAndPlace(g: GameState, player: number, startDepot: number, slot: number, depth: number): void {
  const a = g.players[player].automa!;
  if (depth > MAX_SUB) return;
  const card = pickTargetCard(a, slot);
  if (!card) {
    // 无卡可放(牌库耗尽)→ 城堡奖励规则:改为出售货物
    sellGoods(g, player);
    return;
  }
  // 1) 按补给区顺时针检索活动卡空格类型
  for (let i = 0; i < 6; i++) {
    const depotN = ((startDepot - 1 + i) % 6) + 1;
    const cell = firstEmptyCell(card);
    if (!cell) break;
    const depot = g.depots[depotN - 1];
    const ci = depot.cells.findIndex((t) => t && t.color === cell.color);
    if (ci < 0) continue;
    const tile = depot.cells[ci]!;
    depot.cells[ci] = null;
    cell.filled = tile;
    g.log.push({ player, text: `自动机:补给区${depotN} 拿取${colorZh(tile.color)} → 卡#${card.id}` });
    onPlaced(g, player, tile, card, cell, slot, depth + 1, true);
    return;
  }
  // 2) 储备区检索(读序空格)
  for (const cell of card.cells) {
    if (cell.filled) continue;
    const ri = findInReserve(a, cell.color);
    if (ri >= 0) {
      const tile = a.reserve.splice(ri, 1)[0];
      cell.filled = tile;
      g.log.push({ player, text: `自动机:储备区${colorZh(tile.color)} → 卡#${card.id}` });
      onPlaced(g, player, tile, card, cell, slot, depth + 1, true);
      return;
    }
  }
  // 3) 储备区百搭六角片(黑面朝下)→ 放最靠上靠左空格,不触发放置奖励
  const ui = a.reserve.findIndex((t) => t.black);
  if (ui >= 0) {
    const cell = firstEmptyCell(card)!;
    const tile = a.reserve.splice(ui, 1)[0];
    cell.filled = tile;
    g.log.push({ player, text: `自动机:百搭片 → 卡#${card.id}(无放置奖励)` });
    onPlaced(g, player, tile, card, cell, slot, depth + 1, false);
    return;
  }
  // 4) 黑区最靠上靠左的六角片,正面朝下收入储备区作百搭
  const bi = g.blackDepot.findIndex((t) => t);
  if (bi >= 0) {
    const tile = g.blackDepot[bi]!;
    g.blackDepot[bi] = null;
    a.reserve.push(tile);
    g.log.push({ player, text: `自动机:黑区${colorZh(tile.color)} → 储备区(百搭)` });
    return;
  }
  // 5) 黑区也空:+2 银币
  a.silver += 2;
  g.log.push({ player, text: '自动机:全域无板块,+2银币' });
}

/** 城堡奖励的落卡目标:活动槽卡优先,已满则另一张(p24) */
function pickTargetCard(a: AutomaState, slot: number): AutomaCard | null {
  const c = a.cards[slot];
  if (c && c.cells.some((x) => !x.filled)) return c;
  const other = a.cards[1 - slot];
  if (other && other.cells.some((x) => !x.filled)) return other;
  return null;
}

function firstEmptyCell(card: AutomaCard) {
  return card.cells.find((c) => !c.filled);
}

function findInReserve(a: AutomaState, color: string): number {
  for (let i = a.reserve.length - 1; i >= 0; i--) {       // 顶部优先
    const t = a.reserve[i];
    if (t && !t.black && t.color === color) return i;
  }
  return -1;
}

// ================= 放置后结算链 =================

/** 放置结算:放置奖励 → 郡县卡放置奖励(出售/双生)→ 卡填充;universal=false 跳过放置奖励 */
function onPlaced(g: GameState, player: number, tile: Tile, card: AutomaCard, cell: AutomaCard['cells'][number], slot: number, depth: number, rewards: boolean) {
  const a = g.players[player].automa!;
  if (depth > MAX_SUB * 3) return;
  if (rewards) {
    tileColorReward(g, player, tile, slot, depth);
    if (tile.whitecastle) whitecastleTake(g, player);
  }
  // 郡县卡放置奖励:出售货物 / 双生六角片
  if (cell.sell) sellGoods(g, player);
  if (cell.twin && g.modules.includes('vineyard')) takeTwinForAutoma(g, player);
  // 卡填充完成
  if (card.cells.every((c) => c.filled)) completeCard(g, player, card, slot, depth);
}

/** 六角片放置奖励(p24-25) */
function tileColorReward(g: GameState, player: number, tile: Tile, slot: number, depth: number) {
  const p = g.players[player];
  const a = p.automa!;
  switch (tile.color) {
    case 'red':       // 城堡:白骰点数额外行动
      g.log.push({ player, text: '自动机:城堡奖励 → 额外行动(白骰)' });
      selectAndPlace(g, player, g.whiteDie, slot, depth + 1);
      break;
    case 'brown':
      buildingReward(g, player, tile, slot, depth);
      break;
    case 'green':     // 牲畜:两卡+公国视为同一牧场计分
      addVP(g, player, automaLivestockScore(g, player, tile), '自动机牲畜计分');
      break;
    case 'blue': {    // 船:货物最多补给区全取 + 顺位推进
      let best = -1, bestN = 0;
      for (let i = 0; i < 6; i++) {
        const n = ((g.whiteDie - 1 + i) % 6) + 1;        // 平手从白骰顺时针取先
        const dep = g.depots[n - 1];
        if (dep.goods && 1 > bestN) { bestN = 1; best = n; }
      }
      if (best > 0) {
        const goods = g.depots[best - 1].goods!;
        a.goods[goods.color] = (a.goods[goods.color] ?? 0) + 1;
        g.depots[best - 1].goods = undefined;
        g.log.push({ player, text: `自动机:船 → 补给区${best} 货物(${goods.color}色,存${a.goods[goods.color]})` });
      } else {
        g.log.push({ player, text: '自动机:船 → 无货物可取' });
      }
      advanceTrack(g, player);
      break;
    }
    default:          // 银矿/修道院:无即时效果(修道院效果被忽略)
      break;
  }
  void a;
}

function buildingReward(g: GameState, player: number, tile: Tile, slot: number, depth: number) {
  const a = g.players[player].automa!;
  switch (tile.building) {
    case 'bank': a.silver += 2; g.log.push({ player, text: '自动机:银行 +2银币' }); break;
    case 'dormitory': addVP(g, player, 2, '自动机宿舍'); break;      // 宿舍:+2 分(非工人)
    case 'watchtower': addVP(g, player, 4, '自动机瞭望塔'); break;
    case 'carpenter': // 白骰补给区拿 1 建筑入储备区(顺时针顺延)
      takeColorToReserve(g, player, 'brown');
      break;
    case 'church':    // 城堡 → 银矿 → 修道院
      if (!takeColorToReserve(g, player, 'red')) {
        g.log.push({ player, text: '自动机:教堂无城堡,改拿银矿' });
        if (!takeColorToReserve(g, player, 'gray')) {
          g.log.push({ player, text: '自动机:无银矿,改拿修道院' });
          if (!takeColorToReserve(g, player, 'yellow')) g.log.push({ player, text: '自动机:教堂无目标,落空' });
        }
      }
      break;
    case 'market':    // 船 → 牲畜
      if (!takeColorToReserve(g, player, 'blue')) {
        g.log.push({ player, text: '自动机:市场无船,改拿牲畜' });
        if (!takeColorToReserve(g, player, 'green')) g.log.push({ player, text: '自动机:市场无目标,落空' });
      }
      break;
    case 'cityhall': cityhallReward(g, player, slot, depth); break;
    case 'warehouse': sellGoods(g, player); break;
    case 'crane':     // 吊车:获得城堡的放置奖励(p26)
      g.log.push({ player, text: '自动机:吊车 → 城堡奖励' });
      selectAndPlace(g, player, g.whiteDie, slot, depth + 1);
      break;
    default: break;
  }
}

/** 从白骰补给区顺时针拿指定颜色入储备区;返回是否成功 */
function takeColorToReserve(g: GameState, player: number, color: Tile['color']): boolean {
  for (let i = 0; i < 6; i++) {
    const depotN = ((g.whiteDie - 1 + i) % 6) + 1;
    const depot = g.depots[depotN - 1];
    const ci = depot.cells.findIndex((t) => t && t.color === color);
    if (ci < 0) continue;
    const tile = depot.cells[ci]!;
    depot.cells[ci] = null;
    g.players[player].automa!.reserve.push(tile);
    g.log.push({ player, text: `自动机:补给区${depotN} ${colorZh(color)} → 储备区` });
    return true;
  }
  return false;
}

/** 市政厅:储备区与郡县卡空格匹配的板块立即放置(优先活动卡/数量最多类型) */
function cityhallReward(g: GameState, player: number, slot: number, depth: number) {
  const a = g.players[player].automa!;
  const cards = [a.cards[slot], a.cards[1 - slot]];
  for (const card of cards) {
    if (!card) continue;
    const emptyColors = card.cells.filter((c) => !c.filled).map((c) => c.color);
    if (!emptyColors.length) continue;
    // 类型优先:储备区中数量最多;平手按储备区类型序
    const order = reserveTypeOrder();
    let bestColor = '', bestN = 0;
    for (const color of order) {
      if (!emptyColors.includes(color as Tile['color'])) continue;
      const n = a.reserve.filter((t) => !t.black && t.color === color).length;
      if (n > bestN) { bestN = n; bestColor = color; }
    }
    if (!bestColor) continue;
    const ri = findInReserve(a, bestColor);
    if (ri < 0) continue;
    const tile = a.reserve.splice(ri, 1)[0];
    const cell = card.cells.find((c) => !c.filled && c.color === bestColor)!;
    cell.filled = tile;
    g.log.push({ player, text: `自动机:市政厅 → 储备区${colorZh(bestColor)} → 卡#${card.id}` });
    onPlaced(g, player, tile, card, cell, slot, depth + 1, true);
    return;
  }
  g.log.push({ player, text: '自动机:市政厅无匹配,落空' });
}

/** 自动机牲畜计分:两卡+公国(含溢出)同一牧场;鹅视作只数最多类型 */
function automaLivestockScore(g: GameState, player: number, placed: Tile): number {
  const p = g.players[player];
  const pasture = pastureTiles(g, player);
  const sumOf = (kind: string) => pasture
    .filter((t) => (t.livestock ?? (t.goose ? 'goose' : '')) === kind)
    .reduce((s, t) => s + (t.animals ?? 0), 0);
  if (placed.goose) {
    // 鹅:匹配只数(总只数)最多的牲畜类型
    let bestKind = '', bestN = -1;
    for (const kind of ['chicken', 'sheep', 'cattle', 'pig']) {
      const n = sumOf(kind);
      if (n > bestN) { bestN = n; bestKind = kind; }
    }
    const vp = (placed.animals ?? 0) + (bestN > 0 ? bestN : 0);
    g.log.push({ player, text: `自动机:鹅视为${bestKind || '无'}(${vp}分)` });
    return vp;
  }
  // 后续牲畜:牧场上的鹅视作本次类型
  const gooseN = pasture.filter((t) => t.goose).reduce((s, t) => s + (t.animals ?? 0), 0);
  return (placed.animals ?? 0) + sumOf(placed.livestock ?? '') + gooseN;
}

/** 牧场 = 两张郡县卡 + 公国(含溢出堆)的全部牲畜片(储备区不计) */
function pastureTiles(g: GameState, player: number): Tile[] {
  const p = g.players[player];
  const a = p.automa!;
  const out: Tile[] = [];
  for (const card of a.cards) {
    if (!card) continue;
    for (const c of card.cells) if (c.filled && (c.filled.livestock || c.filled.goose)) out.push(c.filled);
  }
  for (const t of Object.values(p.placed)) if (t.livestock || t.goose) out.push(t);
  for (const t of a.overflow) if (t.livestock || t.goose) out.push(t);
  return out;
}

/** 出售货物(p25):最多的一色全卖;+1银币;每枚 2/3/4 分(按人数);商路+1/次 */
export function sellGoods(g: GameState, player: number): void {
  const a = g.players[player].automa!;
  let color = 0, n = 0;
  for (let c = 1; c <= 6; c++) {
    if ((a.goods[c] ?? 0) > n) { n = a.goods[c]; color = c; }   // 平手取点数最小
  }
  if (color === 0 || n === 0) {
    g.log.push({ player, text: '自动机:无货物可售,落空' });
    return;
  }
  a.goods[color] = 0;
  a.silver += 1;
  a.sellActions += 1;
  addVP(g, player, n * sellPerVP(g.playerCount), `自动机出售 ${n} 货物(${color}色)`);
  if (g.modules.includes('exp8')) addVP(g, player, 1, '自动机商路:+1/次');
}

/** 葡萄园:按白骰点数从商店拿双生片(向右检索,首尾相接) */
function takeTwinForAutoma(g: GameState, player: number): void {
  const shop = g.vineyard?.shopSlots ?? [];
  for (let i = 0; i < shop.length; i++) {
    const s = ((Math.floor((g.whiteDie - 1) / 2) % shop.length) + i) % shop.length;
    const tile = shop[s];
    if (!tile) continue;
    shop[s] = null;
    g.players[player].automa!.twins.push(tile);
    g.log.push({ player, text: `自动机:双生六角片(槽${s + 1})→ 公国旁(存${g.players[player].automa!.twins.length})` });
    return;
  }
  g.log.push({ player, text: '自动机:葡萄园商店无双生片,落空' });
}

/** 白色城堡(自动机侧,p26):储备最少类型,白骰补给区起顺时针拿入储备区 */
function whitecastleTake(g: GameState, player: number): void {
  const a = g.players[player].automa!;
  const order = reserveTypeOrder();
  let target = '', bestN = Infinity;
  for (const color of order) {
    const n = a.reserve.filter((t) => !t.black && t.color === color).length;
    if (n < bestN) { bestN = n; target = color; }
  }
  if (target && takeColorToReserve(g, player, target as Tile['color'])) return;
  a.silver += 1;
  g.log.push({ player, text: '自动机:白堡 → 无目标,+1银币' });
}

// ================= 卡填充 / 迁移 / 奖励板块 =================

function completeCard(g: GameState, player: number, card: AutomaCard, slot: number, depth: number) {
  const p = g.players[player];
  const a = p.automa!;
  if (depth > MAX_SUB * 3) return;
  // 填充得分(按难度)
  addVP(g, player, card.scores[a.difficulty] ?? 5, `自动机卡#${card.id} 填充(${a.difficulty})`);
  // 迁移到公国:读序找同色空格;满则叠放溢出;落 D 标记格触发额外行动
  const board = loadBoards().boards.find((b) => b.id === p.boardId);
  for (const cell of card.cells) {
    const tile = cell.filled;
    if (!tile) continue;
    cell.filled = undefined;
    const universal = tile.black;
    if (universal) tile.black = false;                     // 百搭片翻至正面迁入
    let landed: string | undefined;
    if (board) {
      const cap = board.cells.filter((c) => c.color === tile.color);
      const used = cap.filter((c) => p.placed[`${c.r}:${c.c}`]);
      const free = cap.find((c) => !p.placed[`${c.r}:${c.c}`]);
      if (free) {
        p.placed[`${free.r}:${free.c}`] = tile;
        landed = free.mark;
      } else {
        a.overflow.push(tile);                             // 同色顶叠(容量逻辑按 used 数判定)
        void used;
      }
    } else {
      a.overflow.push(tile);
    }
    if (landed === 'D' && a.modifiers.includes('D')) {
      g.log.push({ player, text: '自动机:D 额外回合 → 额外行动(白骰)' });
      const otherSlot = 1 - slot;
      const target = pickTargetCard(a, otherSlot);
      if (target) selectAndPlace(g, player, g.whiteDie, otherSlot, depth + 1);
      else sellGoods(g, player);
    }
  }
  // 弃卡补位:左槽完成则右卡左移,牌库顶补右槽
  if (slot === 0) {
    a.cards[0] = a.cards[1];
    a.cards[1] = a.deck.shift() ?? null;
  } else {
    a.cards[1] = a.deck.shift() ?? null;
  }
  g.log.push({ player, text: `自动机:卡#${card.id} 弃置,牌库余 ${a.deck.length}` });
  // 奖励板块:公国某色全覆盖(p25)
  claimBonusTiles(g, player);
}

function claimBonusTiles(g: GameState, player: number) {
  const p = g.players[player];
  const a = p.automa!;
  const board = loadBoards().boards.find((b) => b.id === p.boardId);
  if (!board) return;
  const colors = new Set(board.cells.map((c) => c.color));
  for (const color of colors) {
    const cap = board.cells.filter((c) => c.color === color).length;
    if (cap === 0) continue;
    const occupied = board.cells.filter((c) => c.color === color && p.placed[`${c.r}:${c.c}`]).length
      + a.overflow.filter((t) => t.color === color).length;
    if (occupied < cap) continue;
    const claimed = g.rewardClaimed[color] ?? 0;
    const [first, second] = rewardVP(g.playerCount);
    if (claimed >= 2) continue;
    const vp = claimed === 0 ? first : second;
    g.rewardClaimed[color] = claimed + 1;
    addVP(g, player, vp, `自动机${colorZh(color)}全覆盖奖励板块`);
  }
}

// ================= 黑区购买(回合末) =================

function blackPurchase(g: GameState, player: number) {
  const a = g.players[player].automa!;
  if (a.silver < 2) return;
  // 葡萄园:优先购买双生片(p27)
  if (g.modules.includes('vineyard')) {
    const shop = g.vineyard?.shopSlots ?? [];
    for (let i = 0; i < shop.length; i++) {
      const s = ((Math.floor((g.whiteDie - 1) / 2) % shop.length) + i) % shop.length;
      const tile = shop[s];
      if (!tile) continue;
      shop[s] = null;
      a.silver -= 2;
      a.twins.push(tile);
      g.log.push({ player, text: `自动机:-2银币 购双生片(槽${s + 1})` });
      return;
    }
  }
  // 黑区:买储备区数量最少类型,平手按类型序;取黑区最靠上靠左
  const order = reserveTypeOrder();
  let target = '', bestN = Infinity;
  for (const color of order) {
    const n = a.reserve.filter((t) => !t.black && t.color === color).length;
    if (n < bestN) { bestN = n; target = color; }
  }
  if (!target) return;
  const bi = g.blackDepot.findIndex((t) => t && t.color === target);
  if (bi < 0) return;
  const tile = g.blackDepot[bi]!;
  g.blackDepot[bi] = null;
  a.silver -= 2;
  a.reserve.push(tile);
  g.log.push({ player, text: `自动机:-2银币 购黑区${colorZh(target)} → 储备区` });
}

// ================= 终局计分(p25) =================

/** 自动机终局得分明细(修道院×4/货物/银币/储备/未完成卡×2/双生/盾徽/商路) */
export function automaEndgameBreakdown(g: GameState, player: number): { label: string; vp: number }[] {
  const p = g.players[player];
  const a = p.automa!;
  const data = loadAutoma();
  const bd: { label: string; vp: number }[] = [];
  // 修道院(公国+未完成卡,储备区不计)×4
  let mons = Object.values(p.placed).filter((t) => t.color === 'yellow').length;
  let unfinishedTiles = 0;
  for (const card of a.cards) {
    if (!card) continue;
    for (const c of card.cells) {
      if (!c.filled) continue;
      unfinishedTiles += 1;
      if (c.filled.color === 'yellow') mons += 1;
    }
  }
  if (mons) bd.push({ label: `修道院×4(忽略效果)`, vp: mons * 4 });
  const goodsN = a.goods.reduce((s, n) => s + n, 0);
  if (goodsN) bd.push({ label: `未出售货物×${goodsN}`, vp: goodsN });
  if (a.silver) bd.push({ label: `银币×${a.silver}`, vp: a.silver });
  if (a.reserve.length) bd.push({ label: `储备区×${a.reserve.length}`, vp: a.reserve.length });
  if (unfinishedTiles) bd.push({ label: `未完成卡板块×${unfinishedTiles}×2`, vp: unfinishedTiles * 2 });
  // 双生六角片(p28 计分表)
  const twins = a.twins.length;
  if (twins) {
    const vp = data.twinScores[Math.min(twins, 13) - 1] ?? 91;
    bd.push({ label: `双生六角片×${twins}`, vp });
  }
  // 盾徽(不使用效果/不纳贡):1=8 2=15 3=25 4+=40
  const shields = a.shields.length;
  if (shields) {
    const vp = data.shieldScores[Math.min(shields, 4)];
    bd.push({ label: `盾徽×${shields}`, vp });
  }
  // 商路:每次出售货物 +1
  if (g.modules.includes('exp8') && a.sellActions) bd.push({ label: `商路出售×${a.sellActions}`, vp: a.sellActions });
  return bd;
}

function colorZh(c: string): string {
  return ({ yellow: '修道院', blue: '船', red: '城堡', gray: '银矿', green: '牲畜', brown: '建筑', black: '黑' } as Record<string, string>)[c] ?? c;
}
