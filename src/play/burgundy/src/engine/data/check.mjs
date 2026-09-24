// 数据勘定校验(M0d):校验 data/*.json 形状与硬约束(规则书配件总数等)。
// 用法:node src/play/burgundy/src/engine/data/check.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const errors = [];
const warns = [];
const read = (name) => {
  const p = join(dir, name);
  if (!existsSync(p)) { errors.push(`缺文件:${name}`); return null; }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`${name} JSON 语法错误:${e.message}`);
    return null;
  }
};

// ---- central.json ----
const central = read('central.json');
if (central?.data) {
  const c = central.data;
  for (const side of ['front', 'back']) {
    const f = c[side];
    if (!f) { if (side === 'front') errors.push('central.json 缺 front'); continue; }
    if (!Array.isArray(f.depots) || f.depots.length !== 6) errors.push(`central.${side}.depots 必须 6 个`);
    for (const d of f.depots ?? []) {
      if (d.cells?.length !== 4) warns.push(`central.${side} 补给区${d.n} 格数=${d.cells?.length}(3-4人面应为 4;2人面可为 2-3)`);
      for (const cell of d.cells ?? []) {
        if (!['yellow', 'blue', 'red', 'gray', 'green', 'brown'].includes(cell.color)) errors.push(`central.${side} 区${d.n} 非法颜色 ${cell.color}`);
      }
    }
    if (!f.blackDepotCells) errors.push(`central.${side} 缺 blackDepotCells`);
  }
  // 供应可行性(3-4人面硬约束):每阶段每格都补 1 块对应颜色板块。
  // 5 阶段 × 格数 ≤ 该色彩色面供应量;且比例应接近供应构成。
  const SUPPLY = { yellow: 20, blue: 20, red: 14, gray: 10, green: 20, brown: 40 };
  const cellsBy = {};
  for (const d of central.data.front?.depots ?? []) {
    for (const cell of d.cells ?? []) {
      cellsBy[cell.color] = (cellsBy[cell.color] ?? 0) + 1;
    }
  }
  const totalCells = Object.values(cellsBy).reduce((s, x) => s + x, 0);
  if (totalCells > 0) {
    for (const [color, n] of Object.entries(SUPPLY)) {
      const cells = cellsBy[color] ?? 0;
      if (cells * 5 > n) errors.push(`供应不可行:${color} 格 ${cells} 个 × 5 阶段 = ${cells * 5} > 彩色供应 ${n}`);
      else {
        const expect = Math.round(n / 124 * totalCells);
        if (Math.abs(cells - expect) >= 2) warns.push(`${color} 格 ${cells} 个,按供应比例期望 ≈${expect}`);
      }
    }
  }
}

// ---- boards.json ----
const boards = read('boards.json');
if (boards?.data?.boards) {
  const seen = new Set();
  for (const b of boards.data.boards) {
    if (seen.has(b.id)) errors.push(`boards.json 重复 id=${b.id}`);
    seen.add(b.id);
    if (b.cells?.length && b.cells.length !== 37) warns.push(`版图 ${b.id} 格数 ${b.cells.length} ≠ 37`);
    const keys = new Set((b.cells ?? []).map((c) => `${c.r}:${c.c}`));
    if (keys.size !== (b.cells ?? []).length) errors.push(`版图 ${b.id} 存在重复格坐标`);
    for (const c of b.cells ?? []) {
      if (!['yellow', 'blue', 'red', 'gray', 'green', 'brown'].includes(c.color)) errors.push(`版图 ${b.id} 非法颜色 ${c.color}`);
      if (!(c.n >= 1 && c.n <= 6)) errors.push(`版图 ${b.id} 格(${c.r},${c.c}) 骰点非法 ${c.n}`);
    }
  }
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    if (!seen.has(id)) warns.push(`版图 ${id} 缺失(勘定未完成)`);
  }
  // 边境哨所版图 23-30:哨所序号恰为 1-3(同一序号可标多格,如底边豁口触两格)
  const outpostBoards = boards.data.boards.filter((b) => b.id >= 23 && b.id <= 30);
  if (outpostBoards.length !== 8) warns.push(`边境哨所版图 ${outpostBoards.length}/8(勘定未完成)`);
  for (const b of outpostBoards) {
    const nums = new Set((b.cells ?? []).filter((c) => c.outpost != null).map((c) => c.outpost));
    if (nums.size !== 3 || ![1, 2, 3].every((n) => nums.has(n))) errors.push(`版图 ${b.id} 哨所序号异常:${[...nums].join(',')}`);
  }
  // 团队版图 31/32(占位):至少 1 红格供初始城堡
  for (const id of [31, 32]) {
    const b = boards.data.boards.find((x) => x.id === id);
    if (!b) warns.push(`团队版图 ${id} 缺失(占位未建)`);
    else if (!(b.cells ?? []).some((c) => c.color === 'red')) errors.push(`团队版图 ${id} 无红格,初始城堡不可放`);
  }
  // 版图 1-30 颜色配比(勘定不变量:brown12/yellow6/blue6/green6/red4/gray3;偏离仅警告,不强制)
  const BUDGET = { brown: 12, yellow: 6, blue: 6, green: 6, red: 4, gray: 3 };
  for (const b of boards.data.boards) {
    if (b.id > 30 || !b.cells?.length) continue;
    const cnt = {};
    for (const c of b.cells) cnt[c.color] = (cnt[c.color] ?? 0) + 1;
    for (const [col, n] of Object.entries(BUDGET)) {
      if ((cnt[col] ?? 0) !== n) warns.push(`版图 ${b.id} ${col}格 ${cnt[col] ?? 0} ≠ 不变量 ${n}`);
    }
  }
  // 自动机版图 35/36(占位):37 格 + 36 号修正标记计数(规则书 p26 硬约束)
  const b35 = boards.data.boards.find((b) => b.id === 35);
  const b36 = boards.data.boards.find((b) => b.id === 36);
  if (!b35 || !b36) errors.push('boards.json 缺自动机版图 35/36');
  if (b36) {
    const marks = {};
    for (const c of b36.cells ?? []) if (c.mark) marks[c.mark] = (marks[c.mark] ?? 0) + 1;
    if ((marks.A ?? 0) !== 5) errors.push(`版图 36 A 标记 ${(marks.A ?? 0)} ≠ 5(建筑2+牲畜1+船1+修道院1)`);
    if ((marks.B ?? 0) !== 3) errors.push(`版图 36 B 标记 ${(marks.B ?? 0)} ≠ 3(建筑1+银矿1+城堡1)`);
    if (!(marks.D ?? 0)) warns.push('版图 36 无 D(额外回合)标记');
  }
}

// ---- automa.json(占位数据:校验结构与规则书文字硬约束) ----
const automa = read('automa.json');
if (automa?.data) {
  const a = automa.data;
  const COLORS = ['yellow', 'blue', 'red', 'gray', 'green', 'brown'];
  const checkCards = (cards, tag, need) => {
    if (!Array.isArray(cards) || cards.length !== need) { errors.push(`automa.json ${tag} 数量 ${cards?.length} ≠ ${need}`); return; }
    let castleCards = 0;
    const ids = new Set();
    for (const card of cards) {
      if (ids.has(card.id)) errors.push(`automa.json ${tag} 重复卡 id=${card.id}`);
      ids.add(card.id);
      if (!card.cells?.length) errors.push(`automa.json ${tag} 卡 ${card.id} 无格`);
      let hasCastle = false;
      for (const cell of card.cells) {
        if (!COLORS.includes(cell.color)) errors.push(`automa.json ${tag} 卡 ${card.id} 非法颜色 ${cell.color}`);
        if (cell.castle) hasCastle = true;
      }
      if (hasCastle) castleCards++;
      if (!card.scores || !(card.scores.easy > 0) || !(card.scores.normal > 0) || !(card.scores.hard > 0)) {
        errors.push(`automa.json ${tag} 卡 ${card.id} 缺三档填充得分`);
      }
    }
    if (castleCards < 1) errors.push(`automa.json ${tag} 无含城堡格的卡(设置 C 步不可行)`);
  };
  checkCards(a.countyCards, '基础郡县卡', 9);
  checkCards(a.vineyardCountyCards, '葡萄园郡县卡', 8);
  if (a.twinScores?.length !== 13) errors.push('automa.json 双生片计分表长度 ≠ 13(1..13+)');
  if (a.shieldScores?.length !== 5) errors.push('automa.json 盾徽计分表长度 ≠ 5(0..4+)');
  if (!Array.isArray(a.reserveTypeOrder) || a.reserveTypeOrder.length !== 6) errors.push('automa.json 储备区类型序 ≠ 6');
}

// ---- tiles.json ----
const tiles = read('tiles.json');
if (tiles?.data) {
  const t = tiles.data;
  const sum = (arr, k) => arr.reduce((s, x) => s + (x[k] ?? 0), 0);
  if (t.buildings) {
    if (sum(t.buildings, 'count') !== 40) errors.push(`建筑彩色总数 ${sum(t.buildings, 'count')} ≠ 40`);
    if (sum(t.buildings, 'blackCount') !== 16) errors.push(`建筑黑色总数 ${sum(t.buildings, 'blackCount')} ≠ 16`);
    if (t.buildings.length < 8) errors.push('建筑不足 8 种');
  }
  if (t.livestock) {
    if (sum(t.livestock, 'count') !== 20) errors.push(`牲畜彩色总数 ${sum(t.livestock, 'count')} ≠ 20`);
    if (sum(t.livestock, 'blackCount') !== 8) warns.push(`牲畜黑色总数 ${sum(t.livestock, 'blackCount')} ≠ 8`);
    for (const l of t.livestock) if (l.animals < 2 || l.animals > 4) errors.push(`牲畜只数非法:${JSON.stringify(l)}`);
  }
  if (t.mines && (t.mines.colored !== 10 || t.mines.black !== 2)) errors.push('银矿构成 ≠ 10+2');
  if (t.ships && (t.ships.colored !== 20 || t.ships.black !== 6)) errors.push('船构成 ≠ 20+6');
  if (t.monasteries && (t.monasteries.colored !== 20 || t.monasteries.black !== 6)) errors.push('修道院构成 ≠ 20+6');
  if (t.castles && (t.castles.colored !== 14 || t.castles.black !== 2)) errors.push('城堡构成 ≠ 14+2');
  if (t.goods) {
    if (t.goods.perColor * t.goods.colors !== 42) errors.push('货物总数 ≠ 42');
    if (t.goods.valuesPerColor?.length !== 7) errors.push('货物每色点数分布长度 ≠ 7');
  }
}

// ---- monasteries.json ----
const mons = read('monasteries.json');
if (mons?.data) {
  const ns = new Set(mons.data.map((m) => m.n));
  for (let n = 1; n <= 29; n++) if (!ns.has(n)) errors.push(`修道院缺 ${n} 号`);
}

// ---- traderoute.json(P2;占位数据,校验形状与词表) ----
const TRADE_REWARDS = ['workers4', 'workers2', 'silver2', 'silver1', 'vp4', 'vp2', 'takeBuilding', 'takeShipLivestock', 'takeMineMonasteryCastle', 'takeAny'];
const trade = read('traderoute.json');
if (trade?.data) {
  const tiles = trade.data.tiles;
  if (tiles?.length !== 12) errors.push(`商路板块数量 ≠ 12(实际 ${tiles?.length})`);
  for (const t of tiles ?? []) {
    if (t.spaces?.length !== 3) errors.push(`商路板块 ${t.id} 格数 ≠ 3`);
    for (const s of t.spaces ?? []) {
      if (!(s.n >= 1 && s.n <= 6)) errors.push(`商路板块 ${t.id} 非法点数 ${s.n}`);
      if (!TRADE_REWARDS.includes(s.reward)) errors.push(`商路板块 ${t.id} 非法奖励 ${s.reward}`);
    }
  }
}

// ---- vineyard.json(P2;占位数据,校验形状与规则书硬数字) ----
const vine = read('vineyard.json');
if (vine?.data) {
  const v = vine.data;
  if (v.bagCount !== 51) errors.push(`双生片布袋数 ≠ 51(实际 ${v.bagCount})`);
  if (v.bonusTypes?.length !== 6) errors.push('藤奖励类型数 ≠ 6');
  if (v.twinScores?.length !== 13) errors.push('双生计分表长度 ≠ 13(1..13+)');
  if (JSON.stringify(v.twinScores?.slice(0, 3)) !== JSON.stringify([1, 3, 6])) errors.push('双生计分表前 3 档应为 1/3/6');
  for (const key of ['p2', 'p3', 'p4']) {
    const nums = v.supplyNums?.[key];
    if (!Array.isArray(nums)) { errors.push(`vineyard.supplyNums 缺 ${key}`); continue; }
    if (key === 'p4' && nums.length !== 6) errors.push('4人补给区应 6 槽');
    if (key !== 'p4' && nums.length !== 3) errors.push(`${key} 补给区应 3 片(每片 2 点数)`);
  }
  const shop = v.shopSlots;
  if (shop?.p2 !== 1 || shop?.p3 !== 3 || shop?.p4 !== 3) errors.push('商店槽数应为 p2=1/p3=3/p4=3');
  // 官方布袋构成(high):6 纯色×pureEach + C(n,2)×mixedEach = 51
  const comp = v.bagComposition;
  if (comp?.pureColors?.length) {
    const n = comp.pureColors.length;
    const total = n * (comp.pureEach ?? 1) + (n * (n - 1) / 2) * (comp.mixedEach ?? 3);
    if (total !== v.bagCount) errors.push(`布袋构成总数 ${total} ≠ bagCount ${v.bagCount}`);
  }
  // 版图空间(若显式):骰点 1-6;底层恰 2 位且骰点含 1 和 4(规则书确证)
  const spaces = v.board?.spaces;
  if (Array.isArray(spaces) && spaces.length) {
    for (const s of spaces) {
      if (!(s.n >= 1 && s.n <= 6)) errors.push(`vineyard 空间 L${s.layer}S${s.slot} 骰点非法 ${s.n}`);
    }
    const bottom = spaces.filter((s) => s.layer === 0);
    if (bottom.length !== 2 || !bottom.some((s) => s.n === 1) || !bottom.some((s) => s.n === 4)) {
      errors.push('vineyard 底层应恰 2 位且骰点 1/4(规则书 p20 确证)');
    }
  }
}

// ---- 汇总 ----
for (const e of errors) console.error('ERROR', e);
for (const w of warns) console.warn('WARN ', w);
if (errors.length) {
  console.error(`\n校验失败:${errors.length} 错误,${warns.length} 警告`);
  process.exit(1);
}
console.log(`数据校验通过(警告 ${warns.length} 条)`);
