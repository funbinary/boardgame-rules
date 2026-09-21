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

// ---- 汇总 ----
for (const e of errors) console.error('ERROR', e);
for (const w of warns) console.warn('WARN ', w);
if (errors.length) {
  console.error(`\n校验失败:${errors.length} 错误,${warns.length} 警告`);
  process.exit(1);
}
console.log(`数据校验通过(警告 ${warns.length} 条)`);
