// 对局视图:由 GameState 渲染整屏(纯函数,事件由控制器委托处理)。
import { loadBoards } from '../engine/data';
import { actorOf, legalMoves } from '../engine/moves';
import type { GameState, Move } from '../engine/state';
import { COLOR_ZH } from './svg';
import { boardCellSvg, dieSvg, goodsSvg, hexPath, hexX, hexY, playerBadge, tileSvg, escapeHtml } from './svg';

export interface UiSelection {
  die: 0 | 1 | null;
  storage: number | null;
}

const PHASES = ['A', 'B', 'C', 'D', 'E'];

export function renderGame(g: GameState, sel: UiSelection): string {
  const actor = actorOf(g);
  const moves = legalMoves(g);
  const isMyTurn = true; // 热座:本机全权
  void isMyTurn;

  const board = myBoard(g);
  const central = renderCentral(g, sel, moves);
  const panel = renderPanel(g, sel, moves);
  const pending = renderPending(g, moves);
  const header = `
    <header class="game-header">
      <span class="phase">阶段 ${PHASES[g.phase]} · 轮次 ${g.round}/5</span>
      <span class="white">白骰 ${dieSvg(g.whiteDie, '#f2ede2')}</span>
      <span>${playerBadge(g, actor)} 行动中</span>
      <span class="spacer"></span>
      ${g.status === 'ended' ? '<b class="ended">对局结束</b>' : ''}
    </header>`;
  return `${header}<div class="game-grid">${central}<section class="board-wrap">${board}</section>${panel}</div>${pending}`;
}

function myBoard(g: GameState): string {
  const p = g.players[actorOf(g)];
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return '<section>版图缺失</section>';
  let cells = '';
  let maxC = 0;
  for (const cell of b.cells) maxC = Math.max(maxC, cell.c);
  for (const cell of b.cells) {
    const x = hexX(cell.c, cell.r), y = hexY(cell.r);
    const placed = p.placed[`${cell.r}:${cell.c}`];
    const inner = placed ? tileSvg(placed) : boardCellSvg(cell.color, cell.n);
    cells += `<g class="cell" data-r="${cell.r}" data-c="${cell.c}" transform="translate(${x},${y})">${inner}</g>`;
  }
  const w = (maxC + 2) * 48, h = (b.cells.length ? Math.max(...b.cells.map((c) => c.r)) + 2 : 5) * 40;
  return `<h2>${escapeHtml(p.name)} 的公国(版图 ${p.boardId})</h2>
    <svg viewBox="0 0 ${w} ${h}" class="duchy">${cells}</svg>`;
}

function renderCentral(g: GameState, sel: UiSelection, moves: Move[]): string {
  // 补给区行:1-6 + 黑区
  let rows = '';
  for (const dep of g.depots) {
    const tiles = dep.cells.map((t, i) => t
      ? `<g class="depot-tile" data-depot="${dep.n}" data-cell="${i}" transform="translate(${i * 52 + 30},28)">${tileSvg(t)}</g>`
      : '').join('');
    const goods = dep.goods
      ? `<g class="depot-goods" data-depot="${dep.n}" transform="translate(${dep.cells.length * 52 + 46},28)">${goodsSvg(dep.goods.color, dep.goods.value)}</g>`
      : '';
    const canTake = sel.die != null && moves.some((m) => m.t === 'take' && m.depot === dep.n);
    rows += `<div class="depot ${canTake ? 'can' : ''}">
      <span class="depot-n">${dep.n}</span>
      <svg viewBox="0 0 ${dep.cells.length * 52 + 70} 56" width="${(dep.cells.length + 1) * 52 + 18}">${tiles}${goods}</svg>
    </div>`;
  }
  const blackTiles = g.blackDepot.map((t, i) => t
    ? `<g class="black-tile" data-cell="${i}" transform="translate(${i * 52 + 30},28)">${tileSvg(t)}</g>` : '').join('');
  rows += `<div class="depot black ${moves.some((m) => m.t === 'buyBlack') ? 'can' : ''}">
    <span class="depot-n">🪙2</span>
    <svg viewBox="0 0 ${g.blackDepot.length * 52 + 12} 56" width="${g.blackDepot.length * 52 + 12}">${blackTiles}</svg>
  </div>`;
  return `<section class="central"><h2>补给区</h2>${rows}</section>`;
}

function renderPanel(g: GameState, sel: UiSelection, moves: Move[]): string {
  const p = g.players[actorOf(g)];
  const t = g.turn;
  // 骰子
  const dice = [0, 1].map((i) => `<g class="die ${sel.die === i ? 'sel' : ''} ${t.used[i] ? 'used' : ''}" data-die="${i}">${dieSvg(t.dice[i], p.color, t.used[i])}</g>`).join('');
  const bonus = t.bonusDice.length ? `<span class="bonus">奖励行动 ×${t.bonusDice.length}</span>` : '';
  const canMod = (d: number) => sel.die === d && !t.used[d] && p.workers > 0;
  const modBtns = [0, 1].map((d) => `
    <span class="modbtns" data-mod="${d}" style="visibility:${canMod(d) ? 'visible' : 'hidden'}">
      <button data-moddie="${d}" data-delta="-1">−1</button><button data-moddie="${d}" data-delta="1">+1</button>
    </span>`).join('');
  // 储存格
  const storage = p.storage.map((s, i) => s
    ? `<g class="storage-tile ${sel.storage === i ? 'sel' : ''}" data-storage="${i}" transform="translate(${i * 52 + 30},28)">${tileSvg(s)}</g>`
    : `<g transform="translate(${i * 52 + 30},28)"><polygon points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12" fill="#e8dcc8" stroke="#b7a893" stroke-dasharray="4 3"/></g>`).join('');
  // 货物
  const goods = Object.entries(p.goods).filter(([, arr]) => (arr ?? []).length > 0).map(([color, arr]) => {
    const c = +color;
    const canSell = sel.die != null && moves.some((m) => m.t === 'sell' && (m.die === sel.die) && g.turn.dice[m.die as 0 | 1] === c);
    return `<g class="goods ${canSell ? 'can' : ''}" data-sellcolor="${c}">${goodsSvg(c, (arr ?? []).length)}</g>`;
  }).join(' ');
  // 动作按钮
  const canWorkers = sel.die != null && moves.some((m) => m.t === 'takeWorkers' && m.die === sel.die);
  const players = g.players.map((pl) => `<div class="prow ${pl.idx === actorOf(g) ? 'now' : ''}">${playerBadge(g, pl.idx)}</div>`).join('');
  const log = g.log.slice(-14).reverse().map((l) => `<div class="logline">${l.player != null ? `<b>${escapeHtml(g.players[l.player].name)}</b> ` : ''}${escapeHtml(l.text)}</div>`).join('');
  return `<aside class="panel">
    <div class="row dice-row"><svg viewBox="-40 -20 240 40" width="240">${dice}${modBtns}</svg>${bonus}</div>
    <div class="row">
      <button id="btn-workers" ${canWorkers ? '' : 'disabled'}>🛠 拿 2 工人</button>
      <button id="btn-undo">↩ 撤销</button>
    </div>
    <div class="row"><label>储存格</label><svg viewBox="0 0 ${3 * 52 + 12} 56" width="${3 * 52 + 12}">${storage}</svg></div>
    <div class="row"><label>货物(点选=出售)</label><svg viewBox="0 0 200 26" width="200">${goods}</svg></div>
    <div class="row players">${players}</div>
    <div class="log">${log}</div>
  </aside>`;
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
      body = `<p>${top.from === 'cityhall' ? '市政厅:从储存格选择板块放入公国(任意点数)。' : '奖励行动。'}</p>`;
      break;
    default:
      body = `<p>${top.kind}…</p>`;
  }
  return `<div class="pending"><b>${escapeHtml(p.name)}</b> ${body}</div>`;
}

/** SVG 组绑定用的 data 属性 → Move 匹配辅助(控制器用) */
export function matchers(g: GameState, sel: UiSelection, moves: Move[]) {
  void g; void sel; void moves; void hexPath;
  return null;
}
