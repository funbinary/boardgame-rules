// 对局视图:由 GameState 渲染整屏(纯函数,事件由控制器委托处理)。
import { loadBoards, vineyardSpaces } from '../engine/data';
import { resP, storageSlots, teamOf } from '../engine/modules/team';
import { actorOf, legalMoves } from '../engine/moves';
import type { GameState, Move } from '../engine/state';
import { COLOR_HEX, COLOR_ZH } from './svg';
import { boardCellSvg, dieSvg, goodsSvg, hexPath, hexX, hexY, playerBadge, tileSvg, escapeHtml } from './svg';

export interface UiSelection {
  die: 0 | 1 | null;
  storage: number | null;
  /** 双生片放置旋转(P2 葡萄园) */
  rot?: 0 | 1;
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
  const p = resP(g, actorOf(g));
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return '<section>版图缺失</section>';
  let cells = '';
  let maxC = 0;
  let minC = 0;
  for (const cell of b.cells) { maxC = Math.max(maxC, cell.c); minC = Math.min(minC, cell.c); }
  for (const cell of b.cells) {
    const x = hexX(cell.c, cell.r), y = hexY(cell.r);
    const placed = p.placed[`${cell.r}:${cell.c}`];
    const inner = placed ? tileSvg(placed) : boardCellSvg(cell.color, cell.n);
    cells += `<g class="cell" data-r="${cell.r}" data-c="${cell.c}" transform="translate(${x},${y})">${inner}</g>`;
  }
  // 勘定版图用标准 odd-r 坐标,奇数行左边界可到负列,viewBox 需左移
  const vx = Math.min(0, minC) * 49 - 6;
  const w = (maxC - Math.min(0, minC) + 2) * 48, h = (b.cells.length ? Math.max(...b.cells.map((c) => c.r)) + 2 : 5) * 40;
  const team = teamOf(g, actorOf(g));
  return `<h2>${team ? `${team.id} 队的公国(${escapeHtml(g.players[team.members[0]].name)}&${escapeHtml(g.players[team.members[1]].name)})` : `${escapeHtml(p.name)} 的公国`}(版图 ${p.boardId})</h2>
    <svg viewBox="${vx} 0 ${w} ${h}" class="duchy">${cells}</svg>`;
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
  rows += `<div class="depot black ${moves.some((m) => m.t === 'buyBlack' && !m.shop) ? 'can' : ''}">
    <span class="depot-n">🪙2</span>
    <svg viewBox="0 0 ${g.blackDepot.length * 52 + 12} 56" width="${g.blackDepot.length * 52 + 12}">${blackTiles}</svg>
    ${g.modules.includes('exp6') ? `<span class="depot-n pill" title="旅店堆(2银币购)">🏨×${g.innPile}${moves.some((m) => m.t === 'buyInn') ? ' <button id="btn-buyinn" class="mini">购旅店</button>' : ''}</span>` : ''}
  </div>`;
  // 葡萄园补给区 + 商店(P2)
  if (g.vineyard) {
    const spaces = g.vineyard.supply.map((s, i) => s.tile
      ? `<g class="vslot ${moves.some((m) => m.t === 'takeTwin' && m.slot === i) ? 'can' : ''}" data-vslot="${i}" transform="translate(${i * 62 + 34},24)">${tileSvg(s.tile, 40)}<text y="20" font-size="10" text-anchor="middle" fill="#2c2420">${s.ns.join('/')}</text></g>`
      : '').join('');
    rows += `<div class="depot vine"><span class="depot-n pill">🍇补给区</span>
      <svg viewBox="0 0 ${g.vineyard.supply.length * 62 + 20} 56" width="${g.vineyard.supply.length * 62 + 20}">${spaces}</svg></div>`;
    const shop = g.vineyard.shopSlots.map((t, i) => t
      ? `<g class="shop-slot ${moves.some((m) => m.t === 'buyBlack' && m.shop && m.cell === i) ? 'can' : ''}" data-shopcell="${i}" transform="translate(${i * 62 + 34},24)">${tileSvg(t, 40)}</g>`
      : `<g transform="translate(${i * 62 + 34},24)"><polygon points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10" fill="#e8dcc8" stroke="#b7a893" stroke-dasharray="4 3"/></g>`).join('');
    rows += `<div class="depot vine"><span class="depot-n pill">🍷商店🪙2</span>
      <svg viewBox="0 0 ${g.vineyard.shopSlots.length * 62 + 20} 56" width="${Math.max(g.vineyard.shopSlots.length * 62 + 20, 60)}">${shop}</svg></div>`;
  }
  return `<section class="central"><h2>补给区</h2>${rows}</section>`;
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
  const modBtns = [0, 1].map((d) => `
    <span class="modbtns" data-mod="${d}" style="visibility:${canMod(d) ? 'visible' : 'hidden'}">
      <button data-moddie="${d}" data-delta="-1">−1</button><button data-moddie="${d}" data-delta="1">+1</button>
    </span>`).join('');
  // 储存格(团队:私人 2 + 共享 2 统一索引;中间分隔线)
  const slots = storageSlots(g, actorOf(g));
  const privN = team ? me.storage.length : slots.length;
  const emptyHex = (x: number) => `<g transform="translate(${x},28)"><polygon points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12" fill="#e8dcc8" stroke="#b7a893" stroke-dasharray="4 3"/></g>`;
  const storage = slots.map((s, i) => {
    const x = i * 52 + 30 + (team && i >= privN ? 18 : 0);
    return s
      ? `<g class="storage-tile ${sel.storage === i ? 'sel' : ''}" data-storage="${i}" transform="translate(${x},28)">${tileSvg(s)}</g>`
      : emptyHex(x);
  }).join('');
  // 货物
  const goods = Object.entries(p.goods).filter(([, arr]) => (arr ?? []).length > 0).map(([color, arr]) => {
    const c = +color;
    const canSell = sel.die != null && moves.some((m) => m.t === 'sell' && (m.die === sel.die) && g.turn.dice[m.die as 0 | 1] === c);
    return `<g class="goods ${canSell ? 'can' : ''}" data-sellcolor="${c}">${goodsSvg(c, (arr ?? []).length)}</g>`;
  }).join(' ');
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
    <div class="row dice-row"><svg viewBox="-40 -20 240 40" width="240">${dice}${modBtns}</svg>${bonus}</div>
    <div class="row">
      <button id="btn-workers" ${canWorkers ? '' : 'disabled'}>🛠 拿 2 工人</button>
      <button id="btn-undo">↩ 撤销</button>
    </div>
    <div class="row"><label>储存格${team ? '(私1-2/共3-4)' : ''}</label><svg viewBox="0 0 ${Math.max(slots.length, 3) * 52 + (team ? 30 : 12)} 60" width="${Math.max(slots.length, 3) * 52 + (team ? 30 : 12)}">${storage}</svg></div>
    <div class="row"><label>货物(点选=出售)</label><svg viewBox="0 0 200 26" width="200">${goods}</svg></div>
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
  5: '放船选色全取(12)', 6: '复制修道院(12)', 7: '奖励板块×2(8)', 8: '银矿×2(8)',
  9: '售货+1银/枚(8)', 10: '计分修道院×2(8)', 11: '放城堡免费拿盾(8)', 12: '售货分×2(8)',
  13: '盾徽终局×2(4)', 14: '阶段末补拿放置(4)', 15: '阶段末黑区放置(4)', 16: '区域完成+1(4)',
  17: '免邻接(4)', 18: '改骰任意点(4)',
};

const VINE_ZH: Record<string, string> = { red: '红', white: '白', yellow: '黄', green: '绿', blue: '蓝', purple: '紫' };
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
    const inner = rec
      ? `<g transform="translate(${x0},${y})">${tileSvg(rec.tile, 40)}</g>`
      : `<g transform="translate(${x0},${y})"><polygon points="${hexPts(0, 0)}" fill="#efe6d2" fill-opacity="0.7" stroke="#7c6a58"/><text y="4" font-size="12" font-weight="600" text-anchor="middle" fill="#5a4500">${s.n}</text></g>`;
    return `<g class="vspace ${canPlace ? 'can' : ''}"${canPlace ? ` data-vspace="${s.id}" data-vrot="${sel.rot ?? 0}"` : ''}>
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
  void g; void sel; void moves; void hexPath;
  return null;
}
