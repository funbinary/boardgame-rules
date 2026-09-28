// 对局视图:由 GameState 渲染整屏(纯函数,事件由控制器委托处理)。
// 视觉基准:实体「特别典藏版」扫描 —— 主板图(绿纸古地图、花朵补给集群、黑市、
// 阶段/顺位轨)在上,玩家公国板(羊皮纸、酒红饰边、底部储存格+六色货物轨)在下。
import { loadBoards, loadBuildings, loadMonasteries, vineyardSpaces } from '../engine/data';
import { resP, storageSlots, teamOf } from '../engine/modules/team';
import { actorOf, legalMoves } from '../engine/moves';
import type { GameState, Move, Tile, VineBonus } from '../engine/state';
import { COLOR_HEX, COLOR_RIM, COLOR_ZH, GOODS_HEX, GOODS_ICON } from './svg';
import { boardCellSvg, clusterPositions, dieSvg, goodsSvg, goodsTileSvg, hexX, hexY, medallionSvg, playerBadge, tileSvg, escapeHtml } from './svg';

/** 六角片效果提示:悬浮/点击带本属性的元素时浮层展示(接入见 main.ts) */
export function tileTip(t: Tile): string {
  const blackNote = t.black ? '【黑面:可放任意颜色格】' : '';
  if (t.whitecastle) return `${blackNote}白色城堡:放置后立即用白骰当前点数执行一个行动(拿取/放置/出售/工人),可用工人改白骰点数。`;
  if (t.inn) return `${blackNote}旅店:放置不限颜色(骰点仍须匹配),每区域限一座;完成该区域时按规模+1 计分。`;
  if (t.twin) {
    const b = t.twin.bonus.filter(Boolean).map((x) => BONUS_ZH(x)).filter(Boolean).join(' / ');
    return `双生六角片(${t.twin.vines.map((v) => VINE_ZH[v] ?? v).join('+')}):占 2 个储存格;放入葡萄园须匹配空间骰点。${b ? `片上奖励(版图格优先):${b}` : ''}`;
  }
  if (t.monastery) {
    const m = loadMonasteries().find((x) => x.n === t.monastery);
    return `${blackNote}修道院 ${t.monastery}:${m ? `${m.text}${m.when === 'endgame' ? '(终局计分)' : m.when === 'ongoing' ? '(持续效果)' : ''}` : '效果见规则书'}`;
  }
  if (t.building) {
    const b = loadBuildings().find((x) => x.type === t.building);
    return `${blackNote}${b?.name ?? t.building}:${b?.text ?? ''}`;
  }
  if (t.livestock === 'goose' || t.goose) return `${blackNote}鹅:计分时视作牧场内数量最多的物种;此后的牲畜结算中视作所有物种。`;
  if (t.livestock) {
    const zh = LIVESTOCK_ZH[t.livestock] ?? t.livestock;
    return `${blackNote}牲畜(${zh}×${t.animals ?? 2}):立即计分=自身 ${t.animals ?? 2} 分+同牧场同物种每只 1 分。`;
  }
  switch (t.color) {
    case 'red': return `${blackNote}城堡:立即获得一个额外行动(用白骰当前点数执行)。`;
    case 'blue': return `${blackNote}船:回合顺位标记前进一格(若被占则叠顶),并取走一个补给区的全部货物。`;
    case 'gray': return `${blackNote}银矿:放置时无效果;每个阶段结束产 1 银币。`;
    default: return `${blackNote}六角片`;
  }
}

const LIVESTOCK_ZH: Record<string, string> = { chicken: '鸡', sheep: '羊', cattle: '牛', pig: '猪', goose: '鹅' };

/** 奖励行动词表 → 中文(葡萄园版图格/片上) */
export function BONUS_ZH(b: VineBonus | string): string {
  const map: Record<string, string> = {
    workers1: '+1 工人', workers2: '+2 工人', workers4: '+4 工人',
    silver1: '+1 银币', silver2: '+2 银币', vp2: '+2 分', vp4: '+4 分',
    takeBuilding: '拿 1 建筑', takeShipLivestock: '拿 1 船/牲畜', takeMineMonasteryCastle: '拿 1 矿/修道院/城堡',
    takeAny: '补给区任拿 1 块', freeBlack: '黑区免费拿 1', freeTwin: '免费拿 1 双生片', extraAction: '获得 1 次额外行动',
  };
  return map[b] ?? b;
}

const VINE_ZH: Record<string, string> = { red: '红', white: '白', yellow: '黄', green: '绿', blue: '蓝', purple: '紫' };

export interface UiSelection {
  die: 0 | 1 | null;
  storage: number | null;
  /** 双生片放置旋转(P2 葡萄园) */
  rot?: 0 | 1;
}

const PHASES = ['A', 'B', 'C', 'D', 'E'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function renderGame(g: GameState, sel: UiSelection): string {
  const actor = actorOf(g);
  const moves = legalMoves(g);
  const isMyTurn = true; // 热座:本机全权
  void isMyTurn;

  const board = myBoard(g, sel, moves);
  const central = renderCentral(g, sel, moves);
  const panel = renderPanel(g, sel, moves);
  const pending = renderPending(g, moves);
  const header = `
    <header class="game-header">
      <span class="phase">阶段 ${PHASES[g.phase]}(${ROMAN[g.phase]}) · 轮次 ${g.round}/5</span>
      <span class="white">白骰 ${dieSvg(g.whiteDie, '#f2ede2')}</span>
      <span>${playerBadge(g, actor)} 行动中</span>
      <span class="spacer"></span>
      ${g.status === 'ended' ? '<b class="ended">对局结束</b>' : ''}
    </header>`;
  return `${header}<div class="game-grid">${central}<section class="board-wrap">${board}</section>${panel}</div>${pending}`;
}

// ---------------- 玩家公国板(实体版:羊皮纸+酒红饰边;底部储存格+货物轨) ----------------

function myBoard(g: GameState, sel: UiSelection, moves: Move[]): string {
  const p = resP(g, actorOf(g));
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return '<section>版图缺失</section>';
  let cells = '';
  let maxC = 0;
  let minC = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cell of b.cells) { maxC = Math.max(maxC, cell.c); minC = Math.min(minC, cell.c); }
  for (const cell of b.cells) {
    const x = hexX(cell.c, cell.r), y = hexY(cell.r);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const placed = p.placed[`${cell.r}:${cell.c}`];
    const canPlace = sel.storage != null && moves.some((m) => m.t === 'place' && m.r === cell.r && m.c === cell.c);
    const initialCastle = g.pending[g.pending.length - 1]?.kind === 'initialCastle';
    const inner = placed ? tileSvg(placed) : boardCellSvg(cell.color, cell.n);
    const tip = placed ? ` data-tip="${escapeHtml(tileTip(placed))}"` : '';
    cells += `<g class="cell ${canPlace ? 'can' : ''} ${initialCastle && cell.color === 'red' ? 'castle-target' : ''}" data-r="${cell.r}" data-c="${cell.c}"${tip} transform="translate(${x},${y})">${inner}</g>`;
  }
  // 羊皮纸底 + 双线酒红饰边(留 34px 边距画框)
  const pad = 34;
  const bx = minX - pad - 24, by = minY - pad - 10, bw = (maxX - minX) + (pad + 24) * 2, bh = (maxY - minY) + (pad + 10) * 2;
  const frame = `
    <rect x="${bx + 6}" y="${by + 6}" width="${bw}" height="${bh}" rx="20" fill="#5c1019" opacity="0.18"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="18" fill="#f3e7cd" stroke="#7a1f2b" stroke-width="3.5"/>
    <rect x="${bx + 7}" y="${by + 7}" width="${bw - 14}" height="${bh - 14}" rx="13" fill="none" stroke="#c8a86a" stroke-width="1.6"/>
    <rect x="${bx + 11}" y="${by + 11}" width="${bw - 22}" height="${bh - 22}" rx="10" fill="#efe0bf" opacity="0.5"/>`;
  const w = bw + 14, h = bh + 14;
  const team = teamOf(g, actorOf(g));
  const title = team
    ? `${team.id} 队的公国(${escapeHtml(g.players[team.members[0]].name)}&${escapeHtml(g.players[team.members[1]].name)})`
    : `${escapeHtml(p.name)} 的公国`;
  return `<h2>${title}(版图 ${p.boardId})</h2>
    <svg viewBox="${bx - 7} ${by - 7} ${w} ${h}" class="duchy">${frame}${cells}</svg>
    ${duchyStrip(g, sel, moves)}`;
}

/** 公国板底条:储存格 + 六色货物出售轨 + 资源/奖励板块(交互与面板版同源) */
function duchyStrip(g: GameState, sel: UiSelection, moves: Move[]): string {
  const me = g.players[actorOf(g)];
  const p = resP(g, actorOf(g));
  const team = teamOf(g, actorOf(g));
  // 储存格(团队:私人 2 + 共享 2 统一索引;中间分隔)
  const slots = storageSlots(g, actorOf(g));
  const privN = team ? me.storage.length : slots.length;
  const emptyHex = (x: number) => `<g transform="translate(${x},30)"><polygon points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12" fill="#e8dcc8" stroke="#b7a893" stroke-dasharray="4 3"/></g>`;
  const storage = slots.map((s, i) => {
    const x = i * 52 + 30 + (team && i >= privN ? 18 : 0);
    return s
      ? `<g class="storage-tile ${sel.storage === i ? 'sel' : ''}" data-storage="${i}" data-tip="${escapeHtml(tileTip(s))}" transform="translate(${x},30)">${tileSvg(s)}</g>`
      : emptyHex(x);
  }).join('');
  const teamDivider = team ? `<path d="M ${privN * 52 + 24},6 v 48" stroke="#7a1f2b" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${privN * 52 + 33}" y="60" font-size="10" fill="#7a1f2b">共</text>` : '';
  // 六色货物轨(实体版玩家板下缘):点击=出售(每枚 2/3/4 分,按人数)
  const sellEach = g.playerCount === 2 ? 2 : g.playerCount;
  const goodsCells = Array.from({ length: 6 }, (_, i) => {
    const c = i + 1;
    const arr = p.goods[c] ?? [];
    const canSell = sel.die != null && moves.some((m) => m.t === 'sell' && (m.die === sel.die) && g.turn.dice[m.die as 0 | 1] === c);
    const tip = arr.length
      ? `货物色 ${c}(${GOODS_ICON[i]}):持 ${arr.length} 枚,出售得 ${arr.length}×${sellEach}=${arr.length * sellEach} 分(面值 ${arr.map((x) => x.value).join('/')} 供商路匹配)`
      : `货物轨 色${c}(${GOODS_ICON[i]}):未持有该色货物`;
    return `<g class="goods ${canSell ? 'can' : ''}" ${arr.length ? `data-sellcolor="${c}"` : ''} data-tip="${escapeHtml(tip)}" transform="translate(${i * 40 + 22},26)">
      <rect x="-15" y="-15" width="30" height="30" rx="5" fill="${GOODS_HEX[i]}" stroke="#241d18" stroke-width="1.2" fill-opacity="${arr.length ? 1 : 0.35}"/>
      <text y="6" font-size="15" text-anchor="middle">${GOODS_ICON[i]}</text>
      ${arr.length ? `<circle cx="12" cy="-10" r="8" fill="#fdf6e3" stroke="#241d18" stroke-width="1"/><text x="12" y="-6" font-size="10" font-weight="700" text-anchor="middle" fill="#241d18">${arr.length}</text>` : ''}
    </g>`;
  }).join('');
  // 奖励板块小图标
  const bonus = (p.bonusTiles ?? []).map((t) => `<span class="btile" style="background:${COLOR_HEX[t.color]};border-color:${COLOR_RIM[t.color]}" title="${COLOR_ZH[t.color]}奖励板块">${t.value}</span>`).join(' ');
  return `<div class="duchy-strip">
    <div class="strip-box"><label>储存格${team ? '(私|共)' : ''}</label>
      <svg viewBox="0 0 ${Math.max(slots.length, 3) * 52 + (team ? 44 : 12)} 66" width="${Math.max(slots.length, 3) * 52 + (team ? 44 : 12)}">${storage}${teamDivider}</svg></div>
    <div class="strip-box"><label>货物轨(点击=出售该色全部)</label>
      <svg viewBox="0 0 250 50" width="250">${goodsCells}</svg></div>
    <div class="strip-box"><label>资源</label><span class="res">🛠 ${p.workers} · 🪙 ${p.silver}${bonus ? ` · 奖励板块:${bonus}` : ''}</span></div>
  </div>`;
}

// ---------------- 中央主板图(实体版:绿纸古地图、花朵补给集群、黑市、阶段/顺位轨) ----------------

function renderCentral(g: GameState, sel: UiSelection, moves: Move[]): string {
  const CW = 196, CH = 168;                       // 集群网格步进
  const clusterX = (i: number) => 372 + (i % 3) * CW;
  const clusterY = (i: number) => 128 + Math.floor(i / 3) * CH;
  const emptyHexSlot = (x: number, y: number) => `<g transform="translate(${x},${y})"><polygon points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12" fill="#00000010" stroke="#6f5b46" stroke-width="1.1" stroke-dasharray="4 3"/></g>`;
  // 六个编号补给集群:骰点圆盘 + 花朵格 + 内侧货物格
  let clusters = '';
  g.depots.forEach((dep, i) => {
    const cx = clusterX(i), cy = clusterY(i);
    const canTake = sel.die != null && moves.some((m) => m.t === 'take' && m.depot === dep.n);
    const pos = clusterPositions(dep.cells.length);
    let body = '';
    dep.cells.forEach((t, j) => {
      const [sx, sy] = pos[j] ?? [0, 0];
      const x = cx + sx, y = cy + sy;
      if (t) body += `<g class="depot-tile ${canTake ? 'can' : ''}" data-depot="${dep.n}" data-cell="${j}" data-tip="${escapeHtml(tileTip(t))}" transform="translate(${x},${y})">${tileSvg(t)}</g>`;
      else body += emptyHexSlot(x, y);
    });
    body += medallionSvg(dep.n, 16, cx, cy);
    // 货物格(集群左上外角,经典版位置;盾徽扩展的盾徽也印在这)
    const gx = cx - 56, gy = cy - 64;
    const goods = dep.goods
      ? `<g class="depot-goods ${moves.some((m) => m.t === 'answerShipGoods' && m.depot === dep.n) ? 'can' : ''}" data-depot="${dep.n}" transform="translate(${gx},${gy})" data-tip="${escapeHtml(`补给区 ${dep.n} 的货物格:放船时取走全部(当前 ${dep.goods.value} 分/枚)。`)}">${goodsTileSvg(dep.goods.color, dep.goods.value, 30)}</g>`
      : `<g transform="translate(${gx},${gy})"><rect x="-16" y="-16" width="32" height="32" rx="5" fill="#00000010" stroke="#6f5b46" stroke-dasharray="4 3"/><text y="4" font-size="10" text-anchor="middle" fill="#6f5b46">货</text></g>`;
    const shields = (dep.shields ?? []).map((s, k) => `<g transform="translate(${gx + 22},${gy - 8 + k * 16})"><circle r="8" fill="#8e2f38" stroke="#fdf6e3" stroke-width="1.2"/><text y="3.5" font-size="9.5" font-weight="700" text-anchor="middle" fill="#fdf6e3">${s}</text></g>`).join('');
    clusters += `${body}${goods}${shields}`;
  });
  // 黑市:深木底 + 2 银币价签(紧凑 2×3)
  const blackSlots = g.blackDepot.map((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 106 + col * 54, y = 146 + row * 54;
    return t
      ? `<g class="black-tile ${moves.some((m) => m.t === 'buyBlack' && !m.shop && m.cell === i) ? 'can' : ''}" data-cell="${i}" data-tip="${escapeHtml(`${tileTip(t)}(黑区购入价 2 银币,每回合限一次)`)}" transform="translate(${x},${y})">${tileSvg(t)}</g>`
      : emptyHexSlot(x, y);
  }).join('');
  const black = `
    <rect x="28" y="76" width="196" height="244" rx="14" fill="#4a3527" stroke="#2e1f14" stroke-width="2"/>
    <rect x="34" y="82" width="184" height="232" rx="10" fill="none" stroke="#c8a86a" stroke-width="1.2" opacity="0.7"/>
    <text x="126" y="106" text-anchor="middle" font-size="16" font-weight="700" fill="#f3e7cd">黑市</text>
    <text x="126" y="123" text-anchor="middle" font-size="10.5" fill="#d9c8a8">2 🪙 / 块 · 每回合限 1 块</text>
    ${blackSlots}`;
  // 阶段×轮次轨(5×5)+ 顺位轨 + 轮次货物(右列整体左移,填满空腔)
  const px0 = 868, py0 = 96, cell = 24;
  let track = `<text x="${px0 + 2.5 * cell}" y="${py0 - 26}" text-anchor="middle" font-size="11" font-weight="700" fill="#5c4a3a">阶段 / 轮次</text>`;
  ROMAN.forEach((rm, i) => {
    track += `<text x="${px0 + i * cell + cell / 2}" y="${py0 - 8}" text-anchor="middle" font-size="9.5" fill="#7c6a58">${rm}</text>`;
  });
  for (let r = 0; r < 5; r++) {
    track += `<text x="${px0 - 12}" y="${py0 + r * cell + 16}" text-anchor="end" font-size="9.5" fill="#7c6a58">${r + 1}</text>`;
    for (let ph = 0; ph < 5; ph++) {
      const cur = g.status !== 'ended' && ph === g.phase && r + 1 === g.round;
      track += `<rect x="${px0 + ph * cell + 1.5}" y="${py0 + r * cell + 1.5}" width="${cell - 3}" height="${cell - 3}" rx="4"
        fill="${cur ? '#7a1f2b' : '#00000010'}" stroke="${cur ? '#5c1019' : '#6f5b46'}" stroke-width="1"/>`;
      if (cur) track += `<circle cx="${px0 + ph * cell + cell / 2}" cy="${py0 + r * cell + cell / 2}" r="3.4" fill="#f3e7cd"/>`;
    }
  }
  // 顺位轨:g.track 空间(底→顶叠放)
  const ox0 = 856, oy0 = 262;
  let order = `<text x="${ox0}" y="${oy0 - 12}" font-size="11" font-weight="700" fill="#5c4a3a">回合顺位 ⟶</text>`;
  g.track.forEach((stack, i) => {
    const x = ox0 + i * 30;
    order += `<rect x="${x}" y="${oy0}" width="24" height="46" rx="6" fill="#00000010" stroke="#6f5b46" stroke-width="1"/>`;
    stack.forEach((pl, k) => {
      order += `<circle cx="${x + 12}" cy="${oy0 + 12 + k * 11}" r="4.6" fill="${g.players[pl].color === 'blue' ? '#31708e' : g.players[pl].color === 'red' ? '#b7432e' : g.players[pl].color === 'green' ? '#5f8a3c' : '#c98a1e'}" stroke="#241d18" stroke-width="1"/>`;
    });
    order += `<text x="${x + 12}" y="${oy0 + 42}" text-anchor="middle" font-size="8.5" fill="#7c6a58">${i + 1}</text>`;
  });
  // 轮次货物堆(底→顶;每轮开局取走底 1 个;至多展示 6 枚)
  const gy2 = 356;
  const shown = g.roundGoods.slice(0, 6);
  let rg = `<text x="856" y="${gy2 - 12}" font-size="11" font-weight="700" fill="#5c4a3a">轮次货物(底→顶${g.roundGoods.length > 6 ? ` 共${g.roundGoods.length}` : ''})</text>`;
  shown.forEach((t, i) => {
    rg += `<g transform="translate(${864 + i * 34},${gy2 + 12})" ${i === 0 ? 'opacity="1"' : 'opacity="0.55"'}>${goodsTileSvg(t.color, t.value, 26)}</g>`;
  });
  if (!g.roundGoods.length) rg += `<text x="864" y="${gy2 + 16}" font-size="10" fill="#7c6a58">(空)</text>`;
  const board = `<svg viewBox="0 0 1000 400" class="mainboard">
    <rect x="4" y="4" width="992" height="392" rx="18" fill="#e9eed9" stroke="#7a1f2b" stroke-width="3"/>
    <rect x="10" y="10" width="980" height="380" rx="14" fill="none" stroke="#c8a86a" stroke-width="1.4"/>
    <rect x="16" y="16" width="968" height="368" rx="11" fill="#e3e6d0" opacity="0.6"/>
    ${black}${clusters}${track}${order}${rg}
  </svg>`;
  // 附加行:葡萄园补给/商店、旅店堆(P2/第六扩展;沿用 HTML 交互)
  let extra = '';
  if (g.modules.includes('exp6')) {
    extra += `<span class="depot pill">${g.innPile > 0 || moves.some((m) => m.t === 'buyInn') ? `🏨 旅店堆 ×${g.innPile}${moves.some((m) => m.t === 'buyInn') ? ' <button id="btn-buyinn" class="mini">2🪙 购旅店</button>' : ''}` : '🏨 旅店已售罄'}</span>`;
  }
  if (g.vineyard) {
    const spaces = g.vineyard.supply.map((s, i) => s.tile
      ? `<g class="vslot ${moves.some((m) => m.t === 'takeTwin' && m.slot === i) ? 'can' : ''}" data-vslot="${i}" data-tip="${escapeHtml(tileTip(s.tile))}" transform="translate(${i * 62 + 34},24)">${tileSvg(s.tile, 40)}<text y="20" font-size="10" text-anchor="middle" fill="#2c2420">${s.ns.join('/')}</text></g>`
      : '').join('');
    extra += `<span class="depot vine pill">🍇 补给区</span><span class="depot vine"><svg viewBox="0 0 ${g.vineyard.supply.length * 62 + 20} 56" width="${g.vineyard.supply.length * 62 + 20}">${spaces}</svg></span>`;
    const shop = g.vineyard.shopSlots.map((t, i) => t
      ? `<g class="shop-slot ${moves.some((m) => m.t === 'buyBlack' && m.shop && m.cell === i) ? 'can' : ''}" data-shopcell="${i}" data-tip="${escapeHtml(`${tileTip(t)} 2 银币购入(与黑区购买共用每回合一次)。`)}" transform="translate(${i * 62 + 34},24)">${tileSvg(t, 40)}</g>`
      : `<g transform="translate(${i * 62 + 34},24)"><polygon points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10" fill="#e8dcc8" stroke="#b7a893" stroke-dasharray="4 3"/></g>`).join('');
    extra += `<span class="depot vine pill">🍷 商店 2🪙</span><span class="depot vine"><svg viewBox="0 0 ${g.vineyard.shopSlots.length * 62 + 20} 56" width="${Math.max(g.vineyard.shopSlots.length * 62 + 20, 60)}">${shop}</svg></span>`;
  }
  return `<section class="central"><h2 class="vh">主板图</h2>${board}${extra ? `<div class="extra-rows">${extra}</div>` : ''}</section>`;
}

function renderPanel(g: GameState, sel: UiSelection, moves: Move[]): string {
  const me = g.players[actorOf(g)];
  const p = resP(g, actorOf(g));
  const team = teamOf(g, actorOf(g));
  const t = g.turn;
  // 骰子
  const dice = [0, 1].map((i) => `<g class="die ${sel.die === i ? 'sel' : ''} ${t.used[i] ? 'used' : ''}" data-die="${i}">${dieSvg(t.dice[i], p.color, t.used[i])}</g>`).join('');
  const bonus = t.bonusDice.length ? `<span class="bonus">奖励行动 ×${t.bonusDice.length}</span>` : '';
  const canMod = (d: number) => sel.die === d && !t.used[d] && p.workers > 0;
  // 两行常驻显示(骰1/骰2);不满足条件时按钮置灰,不再整行隐藏
  const modBtns = [0, 1].map((d) => `
    <span class="modbtns" data-mod="${d}">
      <small>骰${d + 1}</small><button data-moddie="${d}" data-delta="-1" ${canMod(d) ? '' : 'disabled'}>−1</button><button data-moddie="${d}" data-delta="1" ${canMod(d) ? '' : 'disabled'}>+1</button>
    </span>`).join('');
  // 动作按钮
  const canWorkers = sel.die != null && moves.some((m) => m.t === 'takeWorkers' && m.die === sel.die);
  const players = g.players.map((pl) => `<div class="prow ${pl.idx === actorOf(g) ? 'now' : ''}">${playerBadge(g, pl.idx)}</div>`).join('');
  const automaPanel = renderAutomaPanel(g);
  // 盾徽行(P2):持有 + 对子/免费拿取按钮 + 改骰
  const shieldBtns = moves.filter((m) => m.t === 'takeShield')
    .map((m) => `<button data-takeshield="${(m as { depot: number; idx: number }).depot}:${(m as { idx: number }).idx}">⚔拿盾徽${g.depots[(m as { depot: number }).depot - 1].shields![(m as { idx: number }).idx]}</button>`)
    .join('');
  const shieldFreeBtns = moves.filter((m) => m.t === 'takeShieldFree')
    .map((m) => `<button data-takeshieldfree="${(m as { depot: number; idx: number }).depot}:${(m as { idx: number }).idx}">⚔免费拿盾徽${g.depots[(m as { depot: number }).depot - 1].shields![(m as { idx: number }).idx]}</button>`)
    .join('');
  const skipFree = moves.some((m) => m.t === 'skipShieldFree') ? '<button data-skipshieldfree="1">放弃</button>' : '';
  const setDieBtns = moves.filter((m) => m.t === 'setDie')
    .map((m) => `<button class="mini" data-setdie="${(m as { die: number }).die}:${(m as { value: number }).value}">骰${(m as { die: number }).die + 1}→${(m as { value: number }).value}</button>`)
    .join('');
  const shieldsRow = g.modules.includes('shields') || (p.shields?.length ?? 0) > 0
    ? `<div class="row"><label>盾徽</label><span>${(p.shields ?? []).map((s) => `<b class="shield" title="${SHIELD_NAMES[s] ?? ''}">${s}</b>`).join(' ') || '<small>无</small>'}</span>
        <span>${shieldBtns}${shieldFreeBtns}${skipFree}${setDieBtns}</span></div>`
    : '';
  // 商路行(P2):两行折排,防溢出面板
  const route = p.tradeRoute;
  const routeRow = route
    ? `<div class="row"><label>商路(点数●=已上货物)</label><svg viewBox="0 0 ${Math.ceil(route.length / 2) * 34 + 10} 66" width="100%">${route.map((s, i) => {
        const col = i % Math.ceil(route.length / 2);
        const row = i < Math.ceil(route.length / 2) ? 0 : 1;
        const x = col * 34 + 18;
        const y = row * 34 + 18;
        const filled = i < (p.tradeRoutePlaced ?? 0);
        return `<g transform="translate(${x},${y})"><rect x="-14" y="-14" width="28" height="28" rx="5" fill="${filled ? '#d8c9a8' : '#f0e8d8'}" stroke="#7c6a58"/><text y="-2" font-size="11" font-weight="700" text-anchor="middle" fill="#2c2420">${s.n}</text>${s.good != null ? `<text y="9" font-size="9" text-anchor="middle" fill="#5a4500">●${s.good}</text>` : ''}</g>`;
      }).join('')}</svg></div>`
    : '';
  // 葡萄园面板(P2):补给/商店在中央区;此处放玩家版图与藤奖励
  const vinePanel = g.vineyard && p.vineyard ? renderVineyardBoard(g, p.vineyard, sel, moves) : '';
  const log = g.log.slice(-14).reverse().map((l) => `<div class="logline">${l.player != null ? `<b>${escapeHtml(g.players[l.player].name)}</b> ` : ''}${escapeHtml(l.text)}</div>`).join('');
  return `<aside class="panel">
    <div class="row dice-row"><svg viewBox="-40 -20 240 40" width="240">${dice}</svg><div class="modcol">${modBtns}</div>${bonus}</div>
    <div class="row">
      <button id="btn-workers" ${canWorkers ? '' : 'disabled'}>🛠 拿 2 工人</button>
      <button id="btn-undo">↩ 撤销</button>
    </div>
    ${shieldsRow}
    ${routeRow}
    ${vinePanel}
    ${automaPanel}
    ${team ? `<div class="row"><label>团队(共享)</label><span>工人 ${p.workers}🛠 · 银币 ${p.silver}🪙 · 队友:${escapeHtml(g.players[team.members.find((m) => m !== me.idx) ?? me.idx].name)}</span></div>` : ''}
    <div class="row players">${players}</div>
    <div class="log">${log}</div>
  </aside>`;
}

const SHIELD_NAMES: Record<number, string> = {
  1: '牧场连通(终局12)', 2: '他人获工人+1(12)', 3: '工人代纳贡(12)', 4: '储存无上限(12)',
  5: '放船选色全取(8)', 6: '复制修道院(8)', 7: '奖励板块×2(8)', 8: '银矿×2(8)',
  9: '售货+1银/枚(8)', 10: '计分修道院×2(8)', 11: '放城堡免费拿盾(8)', 12: '售货分×2(8)',
  13: '盾徽终局×2(4)', 14: '阶段末补拿放置(4)', 15: '阶段末黑区放置(4)', 16: '区域完成+1(4)',
  17: '免邻接(4)', 18: '改骰任意点(4)',
};

/** 玩家葡萄园版图(空间格点选放置双生片) */
function renderVineyardBoard(g: GameState, mine: NonNullable<GameState['players'][number]['vineyard']>, sel: UiSelection, moves: Move[]): string {
  void g;
  const spaces = vineyardSpaces();
  const cells = spaces.map((s) => {
    const rec = mine.placed[s.id];
    const canPlace = moves.some((m) => m.t === 'placeTwin' && m.space === s.id && m.rot === (sel.rot ?? 0));
    const x0 = s.slot * 110 + 30;
    const y = s.layer * 46 + 30;
    const hexPts = (cx: number, cy: number) => `${cx},${cy - 22} ${cx + 19},${cy - 11} ${cx + 19},${cy + 11} ${cx},${cy + 22} ${cx - 19},${cy + 11} ${cx - 19},${cy - 11}`;
    const bonusZh = (s.bonuses ?? []).map((x) => BONUS_ZH(x)).join('、');
    const spaceTip = `骰点 ${s.n} · 层 ${s.layer + 1}${bonusZh ? ` · 放置奖励:${bonusZh}` : ''}`;
    const tip = escapeHtml(rec ? `${tileTip(rec.tile)} 放置于:${spaceTip}` : `葡萄园放置位(${spaceTip};首片须底层,之后须与已放片相邻)`);
    const inner = rec
      ? `<g transform="translate(${x0},${y})">${tileSvg(rec.tile, 40)}</g>`
      : `<g transform="translate(${x0},${y})"><polygon points="${hexPts(0, 0)}" fill="#efe6d2" fill-opacity="0.7" stroke="#7c6a58"/><text y="4" font-size="12" font-weight="600" text-anchor="middle" fill="#5a4500">${s.n}</text></g>`;
    return `<g class="vspace ${canPlace ? 'can' : ''}" data-tip="${tip}"${canPlace ? ` data-vspace="${s.id}" data-vrot="${sel.rot ?? 0}"` : ''}>
      <polygon points="${hexPts(x0, y)} ${hexPts(x0 + 46, y)}" fill="transparent"/>${inner}</g>`;
  }).join('');
  const bonuses = mine.bonusTiles.map((b) => `<span class="shield" title="藤奖励:${VINE_ZH[b.type] ?? b.type}" style="border-radius:11px">🍇${VINE_ZH[b.type] ?? b.type}</span>`).join(' ');
  const rotBtn = moves.some((m) => m.t === 'placeTwin') ? `<button id="btn-rot" class="mini">旋转:${sel.rot === 1 ? '是' : '否'}</button>` : '';
  return `<div class="row vine-panel"><label>葡萄园 ${rotBtn}</label>
    <svg viewBox="0 0 380 ${4 * 46 + 14}" width="100%">${cells}</svg>
    <div>${bonuses || '<small>无藤奖励</small>'}</div></div>`;
}

/** 自动机面板:郡县卡/储备区/货物/银币/公国覆盖 */
function renderAutomaPanel(g: GameState): string {
  const a = g.players.find((p) => p.isAutoma);
  if (!a?.automa) return '';
  const st = a.automa;
  const cardSvg = (card: (typeof st.cards)[number], slot: number): string => {
    if (!card) return `<div class="acard empty">槽位空<br><small>牌库 ${st.deck.length}</small></div>`;
    const cells = card.cells.map((c) => {
      const x = (ci: number) => (ci % 2) * 44 + 26;
      const y = (ci: number) => Math.floor(ci / 2) * 44 + 26;
      const ci = card.cells.indexOf(c);
      const inner = c.filled ? tileSvg(c.filled, 34) : `<polygon points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10" fill="${COLOR_HEX[c.color]}" fill-opacity="0.3" stroke="#7c6a58" stroke-dasharray="3 2"/>`;
      const badges = `${c.sell ? '<text x="14" y="-10" font-size="12">🪙</text>' : ''}${c.twin ? '<text x="-14" y="-10" font-size="12">🍇</text>' : ''}${c.castle ? '<text x="0" y="20" font-size="11">🏰</text>' : ''}`;
      return `<g transform="translate(${x(ci)},${y(ci)})">${inner}${badges}</g>`;
    }).join('');
    const score = card.scores[st.difficulty];
    return `<div class="acard"><svg viewBox="0 0 96 96" width="96">${cells}</svg><small>#${card.id} · ${score}分 · ${card.cells.every((c) => c.filled) ? '✓满' : ''}</small></div>`;
  };
  const active = g.whiteDie <= 4 ? 0 : 1;
  const reserve = st.reserve.map((t) => `<g transform="translate(${(st.reserve.indexOf(t)) * 30 + 22},24)">${t.black ? '<polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill="#3a3a3a" stroke="#111"/><text y="4" font-size="9" fill="#ddd" text-anchor="middle">百搭</text>' : tileSvg(t, 30)}</g>`).join('');
  const goodsRow = [1, 2, 3, 4, 5, 6].filter((c) => (st.goods[c] ?? 0) > 0)
    .map((c) => `<g transform="translate(${c * 30},16)">${goodsSvg(c, st.goods[c])}</g>`).join('');
  // 公国覆盖(含溢出)
  const board = loadBoards().boards.find((b) => b.id === a.boardId);
  const cover = board ? [...new Set(board.cells.map((c) => c.color))].map((color) => {
    const cap = board.cells.filter((c) => c.color === color).length;
    const occ = board.cells.filter((c) => c.color === color && a.placed[`${c.r}:${c.c}`]).length + st.overflow.filter((t) => t.color === color).length;
    return `<span class="cov" title="${COLOR_ZH[color]}"><i style="background:${COLOR_HEX[color]};width:${Math.round((occ / cap) * 100)}%"></i></span>`;
  }).join('') : '';
  return `<details class="automa-panel" open>
    <summary>🤖 自动机(难度 ${st.difficulty}${st.modifiers.length ? ` · 修正 ${st.modifiers.join('')}` : ''})</summary>
    <div class="acards">${cardSvg(st.cards[0], 0)}${cardSvg(st.cards[1], 1)}<div class="aslot">${active === 0 ? '◀ 白骰' : '白骰 ▶'}</div></div>
    <div class="arow">🪙 ${st.silver} · 牌库 ${st.deck.length} · 双生 ${st.twins.length}${st.shields.length ? ` · 盾徽 ${st.shields.length}` : ''}</div>
    <div class="arow"><svg viewBox="0 0 ${Math.max(st.reserve.length * 30 + 30, 60)} 48" width="${Math.min(st.reserve.length * 30 + 30, 300)}">${reserve || ''}</svg>${st.reserve.length === 0 ? '<small>储备区空</small>' : ''}</div>
    <div class="arow"><svg viewBox="0 0 200 32" width="200">${goodsRow}</svg></div>
    <div class="arow covrow">${cover}</div>
  </details>`;
}

function renderPending(g: GameState, moves: Move[]): string {
  const top = g.pending[g.pending.length - 1];
  if (!top) return '';
  const p = g.players[top.player];
  let body = '';
  switch (top.kind) {
    case 'initialCastle':
      body = `<p>请在你的公国选择一个 <b>暗红(城堡)格</b> 放置初始城堡。</p>`;
      break;
    case 'shipGoods':
      body = `<p>船只:选择一个补给区拿取其全部货物(点击补给区货物格或编号)。</p>
        <div>${[1, 2, 3, 4, 5, 6].map((d) => `<button data-shipdepot="${d}">补给区 ${d}</button>`).join('')}</div>`;
      break;
    case 'marketTake':
      body = `<p>市场:从补给区点击拿取 1 个 <b>船或牲畜</b>。</p>`;
      break;
    case 'carpenterTake':
      body = `<p>木工坊:从补给区点击拿取 1 个 <b>建筑</b>。</p>`;
      break;
    case 'churchTake':
      body = `<p>教堂:从补给区点击拿取 1 个 <b>银矿/修道院/城堡</b>。</p>`;
      break;
    case 'warehouseSell':
      body = `<p>仓库:选择出售一种颜色的全部货物。</p><div>${moves.filter((m) => m.t === 'answerWarehouseSell').map((m) => `<button data-sellcolor="${(m as { color: number }).color}">${COLOR_ZH.black ? '' : ''}颜色 ${(m as { color: number }).color}</button>`).join('')}</div>`;
      break;
    case 'bonusAction':
      body = `<p>${top.from === 'cityhall' ? '市政厅:从储存格选择板块放入公国(任意点数)。'
        : top.from === 'whitecastle' ? `白色城堡:用白骰点数(${g.whiteDie})执行一个行动——点补给区拿取/公国格放置/货物出售/拿工人。`
        : '奖励行动。'}</p>`;
      break;
    case 'shield5Take':
      body = `<p>盾徽5:选择一种货物色,从全部补给区拿取该色货物。</p>
        <div>${moves.filter((m) => m.t === 'answerShield5').map((m) => `<button data-shield5="${(m as { color: number }).color}"><svg viewBox="-14 -14 28 28" width="26">${goodsSvg((m as { color: number }).color, 1)}</svg></button>`).join('')}</div>`;
      break;
    case 'shield6Target':
      body = `<p>盾徽6:选择要复制修道院的目标玩家。</p>
        <div>${moves.filter((m) => m.t === 'answerShield6').map((m) => `<button data-shield6="${(m as { player: number }).player}">${escapeHtml(g.players[(m as { player: number }).player].name)}</button>`).join('')}</div>`;
      break;
    case 'freePlace':
      body = `<p>盾徽14/15:从${top.from === 'black' ? '黑色补给区' : '补给区'}拿 1 块直接放入公国(骰点不限,颜色/邻接照常),或放弃。</p>
        <div>${moves.filter((m) => m.t === 'answerFreePlace').slice(0, 12).map((m, i) => {
          const mm = m as { from: string; depot?: number; cell: number; r: number; c: number };
          const src = mm.from === 'black' ? '黑区' : `区${mm.depot}`;
          return `<button class="mini" data-freeplace="${i}">${src}#${mm.cell + 1}→(${mm.r},${mm.c})</button>`;
        }).join('')}
        <button data-skipfreeplace="1">放弃</button></div>`;
      break;
    case 'freeBlackTake':
      body = `<p>双生片奖励:从黑色补给区/葡萄园商店免费拿 1 个。</p>
        <div>${moves.filter((m) => m.t === 'answerFreeBlack').map((m) => `<button data-freeblack="${(m as { source: string }).source}:${(m as { cell: number }).cell}">${(m as { source: string }).source === 'black' ? '黑区' : '商店'}#${(m as { cell: number }).cell + 1}</button>`).join('')}</div>`;
      break;
    case 'freeTwinTake':
      body = `<p>双生片奖励:从葡萄园补给区免费拿 1 个双生片。</p>
        <div>${moves.filter((m) => m.t === 'answerFreeTwin').map((m) => `<button data-freetwin="${(m as { slot: number }).slot}">槽${(m as { slot: number }).slot + 1}</button>`).join('')}</div>`;
      break;
    case 'vineBonus':
      body = `<p>葡萄园层覆盖完成:选择 1 个藤奖励板块。</p>
        <div>${moves.filter((m) => m.t === 'takeVineBonus').map((m) => `<button data-vinebonus="${escapeHtml((m as { type: string }).type)}">🍇${VINE_ZH[(m as { type: string }).type] ?? (m as { type: string }).type}</button>`).join('')}</div>`;
      break;
    default:
      body = `<p>${top.kind}…</p>`;
  }
  return `<div class="pending"><b>${escapeHtml(p.name)}</b> ${body}</div>`;
}

/** SVG 组绑定用的 data 属性 → Move 匹配辅助(控制器用) */
export function matchers(g: GameState, sel: UiSelection, moves: Move[]) {
  void g; void sel; void moves;
  return null;
}
