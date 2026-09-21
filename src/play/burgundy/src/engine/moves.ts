// 走子:合法动作枚举与应用。纯函数风格:applyMove 返回新状态(深克隆后改)。
// 任何随机性禁止出现(骰子/布袋都发生在 flow 的固定时机,由 GameState.rng 派生)。
import { loadBoards } from './data';
import { settle } from './flow';
import { regionsOf } from './setup';
import { callHook } from './modules';
import { addVP, livestockScore, PHASE_BONUS, rewardVP, SIZE_VP } from './scoring';
import type { GameState, Move, PlayerState, Tile } from './state';
import type { TileColor } from './types';

export class MoveError extends Error {}

const wrap6 = (v: number) => ((v - 1 + 6) % 6) + 1;

export function actorOf(g: GameState): number {
  const top = g.pending[g.pending.length - 1];
  return top ? top.player : g.turn.player;
}

function boardOf(p: PlayerState) {
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) throw new MoveError(`版图 ${p.boardId} 缺失`);
  return b;
}

/** 拿取行动允许的补给区编号(骰点 ± 修道院12) */
function depotNumsFor(g: GameState, p: PlayerState, v: number): number[] {
  const nums = new Set([v]);
  if (hasMon(p, 12)) { nums.add(wrap6(v + 1)); nums.add(wrap6(v - 1)); }
  return [...nums];
}

/** 放置行动允许的格点数(骰点 ± 修道院9/10/11,按颜色) */
function cellNumsFor(p: PlayerState, color: TileColor, v: number): number[] {
  const nums = new Set([v]);
  const adj =
    (color === 'brown' && hasMon(p, 9)) ||
    ((color === 'blue' || color === 'green') && hasMon(p, 10)) ||
    ((color === 'red' || color === 'gray' || color === 'yellow') && hasMon(p, 11));
  if (adj) { nums.add(wrap6(v + 1)); nums.add(wrap6(v - 1)); }
  return [...nums];
}

function hasMon(p: PlayerState, n: number): boolean {
  return Object.values(p.placed).some((t) => t.monastery === n);
}

function storageFree(p: PlayerState): boolean { return p.storage.some((s) => s == null); }

/** 效果链触发深度保护(市政厅→城堡→…极端连锁) */
const MAX_PENDING_DEPTH = 12;

export function applyMove(prev: GameState, move: Move): GameState {
  const g: GameState = structuredClone(prev);
  const actor = actorOf(g);
  const p = g.players[actor];
  const top = g.pending[g.pending.length - 1];

  // ---- 全局随时可用(自己回合) ----
  if (move.t === 'modDie') {
    requireOwnTurn(g, actor);
    if (g.turn.used[move.die]) throw new MoveError('该骰已使用');
    const step = Math.abs(move.delta);
    if (step !== 1 && !(step === 2 && hasMon(p, 8))) throw new MoveError('工人只能 ±1(修道院8:±2)');
    if (p.workers < 1) throw new MoveError('没有工人');
    p.workers -= 1;
    g.turn.dice[move.die] = wrap6(g.turn.dice[move.die] + move.delta);
    g.log.push({ player: actor, text: `工人改骰:${g.turn.dice[move.die]}` });
    return g;
  }
  if (move.t === 'mon28BuyWorkers') {
    requireOwnTurn(g, actor);
    if (!hasMon(p, 28)) throw new MoveError('无28号修道院');
    if (p.silver < 1) throw new MoveError('银币不足');
    p.silver -= 1; p.workers += 2;
    g.log.push({ player: actor, text: '28号:1银币→2工人' });
    return g;
  }
  if (move.t === 'mon6Buy') {
    requireOwnTurn(g, actor);
    if (!hasMon(p, 6)) throw new MoveError('无6号修道院');
    if (p.mon6Used) throw new MoveError('本回合已用过6号');
    if (p.workers < 2) throw new MoveError('工人不足');
    if (!storageFree(p)) throw new MoveError('储存格已满,先弃置');
    if (move.depot < 1 || move.depot > 6) throw new MoveError('黑区不可用');
    const depot = g.depots[move.depot - 1];
    const tile = depot.cells[move.cell];
    if (!tile || tile.color !== 'brown') throw new MoveError('该格无建筑板块');
    depot.cells[move.cell] = null;
    p.workers -= 2;
    p.mon6Used = true;
    p.storage[p.storage.findIndex((s) => s == null)] = tile;
    g.log.push({ player: actor, text: `6号修道院:-2工人 拿建筑` });
    return g;
  }
  if (move.t === 'buyBlack') {
    // 黑区购买不是行动,回合内任意时刻可执行(含效果链待决期间)
    requireOwnTurn(g, actor);
    if (g.turn.blackBought) throw new MoveError('本回合已购买过黑区');
    if (p.silver < 2) throw new MoveError('银币不足');
    if (!storageFree(p)) throw new MoveError('储存格已满,先弃置');
    const tile = g.blackDepot[move.cell];
    if (!tile) throw new MoveError('黑区该格无板块');
    g.blackDepot[move.cell] = null;
    p.silver -= 2;
    g.turn.blackBought = true;
    p.storage[p.storage.findIndex((s) => s == null)] = tile;
    g.log.push({ player: actor, text: `黑区购买:${tileName(tile)}(-2银币)` });
    return g;
  }
  if (move.t === 'discardStorage') {
    requireOwnTurn(g, actor);
    if (p.storage.some((s) => s == null)) throw new MoveError('储存格未满,无需弃置');
    if (move.slot < 0 || move.slot >= p.storage.length) throw new MoveError('储存格越界');
    (g.players[actor].storage as (Tile | null)[])[move.slot] = null;
    g.log.push({ player: actor, text: '弃置储存格板块' });
    return g;
  }
  if (move.t === 'placeCastle') {
    if (!top || top.kind !== 'initialCastle' || top.player !== actor) throw new MoveError('不是你的初始城堡待决');
    const b = boardOf(p);
    const cell = b.cells.find((c) => c.r === move.r && c.c === move.c);
    if (!cell || cell.color !== 'red') throw new MoveError('必须放在暗红格');
    const castle: Tile = { id: 900000 + actor, color: 'red', black: false };
    p.placed[`${move.r}:${move.c}`] = castle;
    p.castleCell = `${move.r}:${move.c}`;
    g.pending.pop();
    g.log.push({ player: actor, text: '放置初始城堡' });
    if (g.pending.length === 0 && g.status === 'placingCastles') g.status = 'playing';
    return g;
  }

  // ---- 待决应答 ----
  if (top && top.player === actor) {
    switch (top.kind) {
      case 'shipGoods': {
        if (move.t !== 'answerShipGoods') throw new MoveError('等待选择船只拿货补给区');
        const depot = g.depots[move.depot - 1];
        if (!depot) throw new MoveError('补给区不存在');
        if (depot.goods) takeGoods(g, actor, depot.n);
        g.pending.pop();
        advanceTrack(g, actor);
        break;
      }
      case 'marketTake': case 'carpenterTake': case 'churchTake': {
        if (move.t !== 'answerTake') throw new MoveError('等待选择拿取目标');
        answerTakeCheck(g, top.kind, move);
        g.pending.pop();
        break;
      }
      case 'warehouseSell': {
        if (move.t !== 'answerWarehouseSell') throw new MoveError('等待选择出售货物颜色');
        if (!(p.goods[move.color]?.length)) throw new MoveError('无该色货物');
        g.pending.pop();
        doSell(g, actor, move.color);
        break;
      }
      case 'bonusAction': {
        // 市政厅/白堡限定:bonus 只能用于 place
        if (top.from === 'cityhall' && !(move.t === 'place' && move.die === 'bonus')) {
          throw new MoveError('市政厅奖励只能放置板块');
        }
        const mdie = 'die' in move ? move.die : undefined;
        if (mdie !== undefined && mdie !== 'bonus') throw new MoveError('待决奖励行动必须使用 bonus');
        g.pending.pop();
        const r = applyAction(g, actor, move);
        settle(r);
        return r;
      }
      case 'initialCastle':
        throw new MoveError('请先放置初始城堡');
      default:
        break;
    }
    settle(g);
    return g;
  }

  // ---- 常规行动 ----
  if (isAction(move.t)) {
    const r = applyAction(g, actor, move);
    settle(r);
    return r;
  }
  throw new MoveError(`非法走子:${(move as { t: string }).t}`);
}

function isAction(t: string): boolean {
  return t === 'take' || t === 'place' || t === 'sell' || t === 'takeWorkers' ||
    t === 'buyBlack' || t === 'takeTwin' || t === 'placeTwin';
}

function requireOwnTurn(g: GameState, actor: number) {
  if (g.status !== 'playing' && g.status !== 'placingCastles') throw new MoveError('对局未在进行中');
  if (actor !== g.turn.player) throw new MoveError('不是你的回合');
}

/** 行动骰消耗;返回行动用掉的点数 */
function consumeDie(g: GameState, p: PlayerState, move: { die: 0 | 1 | 'bonus'; dieValue?: number }): number {
  if (move.die === 'bonus') {
    if (!g.turn.bonusDice.length) throw new MoveError('没有奖励行动');
    if (move.dieValue == null) throw new MoveError('奖励行动需指定点数');
    g.turn.bonusDice.pop();
    return move.dieValue;
  }
  if (g.turn.used[move.die]) throw new MoveError('该骰已使用');
  g.turn.used[move.die] = true;
  return g.turn.dice[move.die];
}

function applyAction(g: GameState, actor: number, move: Move): GameState {
  const p = g.players[actor];
  switch (move.t) {
    case 'take': {
      const v = consumeDie(g, p, move);
      if (!storageFree(p)) throw new MoveError('储存格已满,先弃置');
      if (!depotNumsFor(g, p, v).includes(move.depot)) throw new MoveError('骰点与补给区不匹配');
      const depot = g.depots[move.depot - 1];
      const tile = depot.cells[move.cell];
      if (!tile) throw new MoveError('该格无板块');
      depot.cells[move.cell] = null;
      const slot = p.storage.findIndex((s) => s == null);
      p.storage[slot] = tile;
      g.log.push({ player: actor, text: `拿取:${tileName(tile)}(补给区${move.depot})` });
      break;
    }
    case 'place': {
      const v = consumeDie(g, p, move);
      const tile = p.storage[move.storage];
      if (!tile) throw new MoveError('储存格为空');
      const b = boardOf(p);
      const cell = b.cells.find((c) => c.r === move.r && c.c === move.c);
      if (!cell) throw new MoveError('格子不存在');
      if (p.placed[`${move.r}:${move.c}`]) throw new MoveError('格子已被占用');
      if (cell.color !== tile.color) throw new MoveError('颜色不匹配');
      if (!cellNumsFor(p, tile.color, v).includes(cell.n)) throw new MoveError('骰点与格点不匹配');
      if (!adjacencyOk(p, b, move.r, move.c)) throw new MoveError('必须与已放板块相邻');
      p.storage[move.storage] = null;
      p.placed[`${move.r}:${move.c}`] = tile;
      g.log.push({ player: actor, text: `放置:${tileName(tile)}→(${move.r},${move.c})` });
      // 扩展钩子:放置后触发
      callHook(g, 'onPlace', actor, tile, move.r, move.c);
      resolvePlacement(g, actor, tile, move.r, move.c);
      break;
    }
    case 'sell': {
      const v = consumeDie(g, p, move);
      if (!p.goods[v]?.length) throw new MoveError('没有对应颜色的货物');
      doSell(g, actor, v);
      break;
    }
    case 'takeWorkers': {
      consumeDie(g, p, move);
      const n = hasMon(p, 14) ? 4 : 2;
      p.workers += n;
      if (hasMon(p, 13)) p.silver += 1;
      g.log.push({ player: actor, text: `拿取 ${n} 工人${hasMon(p, 13) ? '(+1银币)' : ''}` });
      break;
    }
    case 'takeTwin': case 'placeTwin':
      throw new MoveError('葡萄园扩展未接入(M2b)');
    default:
      throw new MoveError('未知行动');
  }
  return g;
}

/** 放置结算:区域完成/奖励板块/各色板块效果 */
function resolvePlacement(g: GameState, actor: number, tile: Tile, r: number, c: number) {
  const p = g.players[actor];
  // 区域完成
  const regs = regionsOf(p.boardId);
  const region = regs.regions[regs.regionOf[`${r}:${c}`]];
  if (region.cells.every((k) => p.placed[k])) {
    const size = region.cells.length;
    addVP(g, actor, (SIZE_VP[size] ?? 0) + PHASE_BONUS[g.phase], `完成${colorName(region.color)}区域×${size}`);
  }
  // 颜色全完成 → 奖励板块
  const total = boardOf(p).cells.filter((x) => x.color === tile.color).length;
  const placed = Object.values(p.placed).filter((t) => t.color === tile.color).length;
  if (placed >= total && total > 0) {
    const claimed = g.rewardClaimed[tile.color] ?? 0;
    const [first, second] = rewardVP(g.playerCount);
    if (claimed < 2) {
      const vp = claimed === 0 ? first : second;
      g.rewardClaimed[tile.color] = claimed + 1;
      p.bonusTiles.push({ color: tile.color, value: vp });
      addVP(g, actor, vp, `${colorName(tile.color)}色奖励板块`);
    }
  }
  // 板块效果
  switch (tile.color) {
    case 'blue':   // 船:拿货(待决)+顺位推进(应答后)
      pushPending(g, { kind: 'shipGoods', player: actor });
      break;
    case 'red':    // 城堡:奖励行动
      g.turn.bonusDice.push(0);
      g.log.push({ player: actor, text: '城堡:获得一个额外行动' });
      break;
    case 'green':  // 牲畜计分
      addVP(g, actor, livestockScore(g, actor, tile, r, c), '牲畜');
      break;
    case 'brown':
      resolveBuilding(g, actor, tile);
      break;
    default:
      break; // 银矿(阶段末)/修道院(持续或终局)
  }
  void p;
}

function resolveBuilding(g: GameState, actor: number, tile: Tile) {
  const p = g.players[actor];
  switch (tile.building) {
    case 'market': case 'carpenter': case 'church': {
      const want = tile.building === 'market' ? ['blue', 'green']
        : tile.building === 'carpenter' ? ['brown'] : ['red', 'gray', 'yellow'];
      const any = storageFree(p) && g.depots.some((d) => d.cells.some((t) => t && want.includes(t.color)));
      if (any) pushPending(g, { kind: tile.building === 'market' ? 'marketTake' : tile.building === 'carpenter' ? 'carpenterTake' : 'churchTake', player: actor });
      else g.log.push({ player: actor, text: '建筑效果无法结算,落空' });
      break;
    }
    case 'warehouse': {
      if (Object.values(p.goods).some((pile) => pile.length > 0)) pushPending(g, { kind: 'warehouseSell', player: actor });
      else g.log.push({ player: actor, text: '仓库无可售货物,落空' });
      break;
    }
    case 'dormitory': p.workers += 4; g.log.push({ player: actor, text: '宿舍:+4工人' }); break;
    case 'bank': p.silver += 2; g.log.push({ player: actor, text: '银行:+2银币' }); break;
    case 'cityhall': {
      if (placeMoves(g, actor, 'bonus', 1).length > 0 || placeMoves(g, actor, 'bonus', 6).length > 0 || placeMoves(g, actor, 'bonus', 3).length > 0) {
        pushPending(g, { kind: 'bonusAction', player: actor, from: 'cityhall' });
        g.turn.bonusDice.push(0);
      } else g.log.push({ player: actor, text: '市政厅无可放置板块,落空' });
      break;
    }
    case 'watchtower': addVP(g, actor, 4, '瞭望塔'); break;
    case 'crane': /* TODO M2b: 吊车选择 */ break;
    default: break;
  }
}

function pushPending(g: GameState, pm: GameState['pending'][number]) {
  if (g.pending.length >= MAX_PENDING_DEPTH) throw new MoveError('效果链过深(异常状态)');
  g.pending.push(pm);
}

function answerTakeCheck(g: GameState, kind: string, move: Extract<Move, { t: 'answerTake' }>) {
  const actor = actorOf(g);
  const p = g.players[actor];
  if (!storageFree(p)) throw new MoveError('储存格已满');
  const depot = g.depots[move.depot - 1];
  if (!depot || move.depot === 0) throw new MoveError('黑区不可用于建筑效果');
  const tile = depot.cells[move.cell];
  if (!tile) throw new MoveError('该格无板块');
  const ok =
    (kind === 'marketTake' && (tile.color === 'blue' || tile.color === 'green')) ||
    (kind === 'carpenterTake' && tile.color === 'brown') ||
    (kind === 'churchTake' && (tile.color === 'red' || tile.color === 'gray' || tile.color === 'yellow'));
  if (!ok) throw new MoveError('板块类型不符');
  depot.cells[move.cell] = null;
  p.storage[p.storage.findIndex((s) => s == null)] = tile;
  g.log.push({ player: actor, text: `建筑效果拿取:${tileName(tile)}` });
}

/** 卖货(骰子行动与仓库共用);返回出售数量 */
function doSell(g: GameState, actor: number, color: number): number {
  const p = g.players[actor];
  const pile = p.goods[color] ?? [];
  if (!pile.length) return 0;
  const n = pile.length;
  p.goods[color] = [];
  p.soldGoods.push(...pile);
  p.silver += hasMon(p, 3) ? 2 : 1;
  if (hasMon(p, 4)) p.workers += 1;
  addVP(g, actor, n * sellEach(g) * 1, `出售${n}货物`);
  void g;
  return n;
}

function sellEach(g: GameState): number { return g.playerCount === 2 ? 2 : g.playerCount; }

function takeGoods(g: GameState, actor: number, depotN: number) {
  const p = g.players[actor];
  const depot = g.depots[depotN - 1];
  const goods = depot.goods;
  if (!goods) return;
  const colorsOwned = new Set(Object.keys(p.goods).filter((k) => (p.goods[+k] ?? []).length > 0).map(Number));
  if (colorsOwned.has(goods.color) || colorsOwned.size < 3) {
    (p.goods[goods.color] ??= []).push(goods);
    depot.goods = undefined;
    g.log.push({ player: actor, text: `船:获得货物(${goods.color}色)` });
  } else {
    g.log.push({ player: actor, text: '船:货物色超限,留在补给区' });
  }
}

/** 顺位轨推进 1 格(同格压顶;27号修道院持有者永远在顶部) */
export function advanceTrack(g: GameState, player: number) {
  for (let s = g.track.length - 1; s >= 0; s--) {
    const i = g.track[s].indexOf(player);
    if (i >= 0) {
      g.track[s].splice(i, 1);
      if (s + 1 >= g.track.length) g.track.push([]);
      const target = g.track[s + 1];
      const mon27idx = target.findIndex((q) => q !== player && Object.values(g.players[q].placed).some((t) => t.monastery === 27));
      if (mon27idx >= 0) target.splice(mon27idx, 0, player);   // 插到 27 号持有者下方
      else target.push(player);
      g.log.push({ player, text: '顺位轨推进' });
      return;
    }
  }
}

function adjacencyOk(p: PlayerState, b: { cells: { r: number; c: number }[] }, r: number, c: number): boolean {
  const even = r % 2 === 0;
  const dirs = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  const isFirst = Object.keys(p.placed).length === 1;   // 仅初始城堡
  for (const [dr, dc] of dirs) {
    const k = `${r + dr}:${c + dc}`;
    if (isFirst) {
      if (k === p.castleCell) return true;
    } else if (p.placed[k]) return true;
  }
  if (isFirst) {
    // 城堡邻接兜底(如 castleCell 未记录)
    return !!p.castleCell && b.cells.some((cell) => `${cell.r}:${cell.c}` === p.castleCell)
      ? dirs.some(([dr, dc]) => `${r + dr}:${c + dc}` === p.castleCell) : false;
  }
  return false;
}

function tileName(t: Tile): string {
  if (t.monastery) return `修道院${t.monastery}`;
  if (t.building) return t.building;
  if (t.livestock) return `${t.animals}${t.livestock}`;
  return colorName(t.color);
}

function colorName(c: TileColor): string {
  return ({ yellow: '修道院', blue: '船', red: '城堡', gray: '银矿', green: '牲畜', brown: '建筑', black: '黑' } as Record<string, string>)[c] ?? c;
}

// ================= legalMoves =================

/** 枚举当前行动者全部合法走子(UI 高亮 / AI / 自动机代走共用) */
export function legalMoves(g: GameState): Move[] {
  const out: Move[] = [];
  const actor = actorOf(g);
  const p = g.players[actor];
  if (g.status === 'ended') return out;

  // 随时类
  if (g.status === 'playing' && actor === g.turn.player) {
    for (const d of [0, 1] as const) {
      if (!g.turn.used[d] && p.workers > 0) {
        out.push({ t: 'modDie', die: d, delta: 1 });
        out.push({ t: 'modDie', die: d, delta: -1 });
        if (hasMon(p, 8)) { out.push({ t: 'modDie', die: d, delta: 2 }); out.push({ t: 'modDie', die: d, delta: -2 }); }
      }
    }
    if (hasMon(p, 28) && p.silver >= 1) out.push({ t: 'mon28BuyWorkers' });
    if (hasMon(p, 6) && !p.mon6Used && p.workers >= 2 && storageFree(p)) {
      g.depots.forEach((dep, di) => dep.cells.forEach((t, ci) => {
        if (t && t.color === 'brown') out.push({ t: 'mon6Buy', depot: di + 1, cell: ci });
      }));
    }
    if (p.storage.every((s) => s != null)) {
      p.storage.forEach((s, i) => { if (s != null) out.push({ t: 'discardStorage', slot: i }); });
    }
    // 黑区购买
    if (!g.turn.blackBought && p.silver >= 2 && storageFree(p)) {
      g.blackDepot.forEach((t, i) => { if (t) out.push({ t: 'buyBlack', cell: i }); });
    }
  }

  // 初始城堡
  const top = g.pending[g.pending.length - 1];
  if (top?.kind === 'initialCastle' && top.player === actor) {
    for (const c of boardOf(p).cells) {
      if (c.color === 'red' && !p.placed[`${c.r}:${c.c}`]) out.push({ t: 'placeCastle', r: c.r, c: c.c });
    }
    return out;
  }

  if (g.status !== 'playing') return out;

  // 待决应答
  if (top && top.player === actor) {
    switch (top.kind) {
      case 'shipGoods':
        for (let d = 1; d <= 6; d++) out.push({ t: 'answerShipGoods', depot: d });
        return out;
      case 'marketTake': case 'carpenterTake': case 'churchTake': {
        if (storageFree(p)) {
          const want = top.kind === 'marketTake' ? ['blue', 'green']
            : top.kind === 'carpenterTake' ? ['brown'] : ['red', 'gray', 'yellow'];
          g.depots.forEach((dep, di) => dep.cells.forEach((t, ci) => {
            if (t && want.includes(t.color)) out.push({ t: 'answerTake', depot: di + 1, cell: ci });
          }));
        }
        return out;
      }
      case 'warehouseSell': {
        for (const k of Object.keys(p.goods)) {
          const color = +k;
          if ((p.goods[color] ?? []).length > 0) out.push({ t: 'answerWarehouseSell', color });
        }
        return out;
      }
      case 'bonusAction': {
        if (top.from === 'cityhall') {
          const seen = new Set<string>();
          for (let v = 1; v <= 6; v++) {
            for (const m of placeMoves(g, actor, 'bonus', v)) {
              const pm = m as Extract<Move, { t: 'place' }>;
              const key = `${pm.storage}:${pm.r}:${pm.c}`;
              if (!seen.has(key)) { seen.add(key); out.push(m); }
            }
          }
          return out;
        }
        // 白堡等:按白骰点数(M2b)
        return out;
      }
      default: return out;
    }
  }

  if (actor !== g.turn.player) return out;

  // 常规行动
  const dice: { die: 0 | 1 | 'bonus'; v: number }[] = [];
  if (!g.turn.used[0]) dice.push({ die: 0, v: g.turn.dice[0] });
  if (!g.turn.used[1]) dice.push({ die: 1, v: g.turn.dice[1] });
  for (const b of g.turn.bonusDice) {
    for (let v = 1; v <= 6; v++) dice.push({ die: 'bonus', v });
  }

  for (const { die, v } of dice) {
    // 拿取
    if (storageFree(p)) {
      for (const n of depotNumsFor(g, p, v)) {
        const dep = g.depots[n - 1];
        if (!dep) continue;
        dep.cells.forEach((t, ci) => { if (t) out.push({ t: 'take', die, depot: n, cell: ci, dieValue: die === 'bonus' ? v : undefined }); });
      }
    }
    // 放置
    for (const m of placeMoves(g, actor, die, die === 'bonus' ? v : undefined)) out.push(m);
    // 卖货
    if (p.goods[v]?.length) out.push({ t: 'sell', die, dieValue: die === 'bonus' ? v : undefined });
    // 工人
    out.push({ t: 'takeWorkers', die });
  }
  return out;
}

function placeMoves(g: GameState, actor: number, die: 0 | 1 | 'bonus', dieValue?: number): Move[] {
  const out: Move[] = [];
  const p = g.players[actor];
  const b = boardOf(p);
  p.storage.forEach((tile, si) => {
    if (!tile) return;
    for (const cell of b.cells) {
      if (p.placed[`${cell.r}:${cell.c}`]) continue;
      if (cell.color !== tile.color) continue;
      const v = die === 'bonus' ? dieValue! : g.turn.dice[die];
      if (!cellNumsFor(p, tile.color, v).includes(cell.n)) continue;
      if (!adjacencyOk(p, b, cell.r, cell.c)) continue;
      out.push({ t: 'place', die, storage: si, r: cell.r, c: cell.c, dieValue: die === 'bonus' ? v : undefined });
    }
  });
  return out;
}
