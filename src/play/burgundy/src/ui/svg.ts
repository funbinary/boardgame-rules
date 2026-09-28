// SVG 渲染:六角网格、板块、骰子、货物。全部内联 SVG,无外部素材。
// 视觉基准:实体「特别典藏版」(Awaken Realms) 主板图/玩家板扫描 ——
// 羊皮纸底、酒红饰边、花朵状补给集群围绕骰点圆盘、柔和但饱满的六角色。
import type { GameState, Tile } from '../engine/state';
import type { TileColor } from '../engine/types';
import { resP } from '../engine/modules/team';

/** 实体版调色板:主色 + 深色描边(格/片的双层勾线营造厚度) */
export const COLOR_HEX: Record<TileColor, string> = {
  yellow: '#dcae3e', blue: '#3f7098', red: '#8e2f38', gray: '#a39a8e',
  green: '#77a054', brown: '#bd9062', black: '#37312c',
};
export const COLOR_RIM: Record<TileColor, string> = {
  yellow: '#8a6512', blue: '#1f3c58', red: '#4d1218', gray: '#57524a',
  green: '#3c5c26', brown: '#6d4c26', black: '#141110',
};
export const COLOR_ZH: Record<TileColor, string> = {
  yellow: '修道院', blue: '船', red: '城堡', gray: '银矿', green: '牲畜', brown: '建筑', black: '黑',
};

const HEX_W = 46;   // 尖顶六角宽
const HEX_H = 52;   // 高
export const hexX = (c: number, r: number) => (c + (r % 2) * 0.5) * HEX_W * 1.02 + HEX_W / 2 + 4;
export const hexY = (r: number) => r * HEX_H * 0.75 + HEX_H / 2 + 4;

/** 单个尖顶六角 path */
export function hexPath(cx: number, cy: number, w = HEX_W, h = HEX_H): string {
  const hw = w / 2, hh = h / 2;
  return `M${cx},${cy - hh} L${cx + hw * 0.866},${cy - h * 0.25} L${cx + hw * 0.866},${cy + h * 0.25} L${cx},${cy + hh} L${cx - hw * 0.866},${cy + h * 0.25} L${cx - hw * 0.866},${cy - h * 0.25} Z`;
}

/** 尖顶六角 polygon points(以 (0,0) 为中心,size=高) */
export function hexPoints(size = HEX_H): string {
  const hw = size * 0.4, hh = size / 2;
  return `0,${-hh} ${hw},${-size * 0.25} ${hw},${size * 0.25} 0,${hh} ${-hw},${size * 0.25} ${-hw},${-size * 0.25}`;
}

/** 板块图标(自绘扁平小图) */
export function tileGlyph(t: Tile): string {
  if (t.twin) return twinGlyph(t.twin.vines);
  if (t.inn) return innGlyph();
  if (t.whitecastle) return castleGlyph('#ffffff');
  if (t.goose) return `<text y="8" font-size="26" text-anchor="middle">🦢</text>`;
  if (t.monastery) return `<text y="9" font-size="24" font-weight="700" fill="#5a4500" text-anchor="middle">${t.monastery}</text>`;
  if (t.building) return buildingGlyph(t.building);
  if (t.livestock) return livestockGlyph(t);
  switch (t.color) {
    case 'blue': return shipGlyph();
    case 'red': return castleGlyph('#f6e7cf');
    case 'gray': return `<circle r="7" fill="none" stroke="#fff" stroke-width="2"/><circle r="3" fill="#fff"/>`;
    default: return '';
  }
}

const VINE_HEX: Record<string, string> = {
  red: '#a33', white: '#eee', yellow: '#db3', green: '#3a7', blue: '#36a', purple: '#73a',
};
/** 双生六角片:两道藤色条纹 */
function twinGlyph(vines: [string, string]): string {
  const stripe = (v: string, dy: number) => `<rect x="-14" y="${dy - 5}" width="28" height="10" rx="3" fill="${VINE_HEX[v] ?? '#888'}" stroke="#2c2420" stroke-width="0.8"/>`;
  return `${stripe(vines[0], -6)}${stripe(vines[1], 6)}`;
}

function buildingGlyph(b: string): string {
  const s = 'fill="none" stroke="#3d2b1f" stroke-width="2" stroke-linecap="round"';
  switch (b) {
    case 'market': return `<g ${s}><path d="M-9,8 h18 M-9,8 l3,-6 h12 l3,6"/><path d="M-6,2 v-4 M0,2 v-4 M6,2 v-4"/></g>`;
    case 'carpenter': return `<g ${s}><path d="M-8,8 h16 l-4,-8 h-8 z"/><path d="M-2,0 l6,-6"/></g>`;
    case 'church': return `<g ${s}><path d="M0,-9 v18 M-7,9 v-9 h14 v9"/><circle cy="-11" r="1.6" fill="#3d2b1f"/></g>`;
    case 'warehouse': return `<g ${s}><rect x="-9" y="-4" width="18" height="12"/><path d="M-9,-4 l3,-5 h12 l3,5"/></g>`;
    case 'dormitory': return `<g ${s}><rect x="-8" y="-6" width="16" height="14"/><path d="M-4,0 h8 M0,-3 v6"/></g>`;
    case 'bank': return `<g ${s}><path d="M-9,6 h18 M-7,6 v-8 M7,6 v-8 M-9,-2 h18"/></g>`;
    case 'cityhall': return `<g ${s}><path d="M-9,8 h18 M-7,8 v-10 M7,8 v-10 M-9,-2 h18"/><path d="M0,-11 l3,3 h-6 z"/></g>`;
    case 'watchtower': return `<g ${s}><path d="M-5,8 v-12 h10 v12 M-5,-4 l-2,-4 h14 l-2,4"/></g>`;
    case 'crane': return `<g ${s}><path d="M0,8 v-14 l8,4"/><path d="M0,-6 h9 v4 h-6"/></g>`;
    default: return '';
  }
}

function livestockGlyph(t: Tile): string {
  const n = t.animals ?? 2;
  const emoji = t.livestock === 'chicken' ? '🐔' : t.livestock === 'sheep' ? '🐑' : t.livestock === 'cattle' ? '🐄' : t.livestock === 'pig' ? '🐖' : '🦢';
  const gap = n > 2 ? 11 : 14;
  const start = -((n - 1) * gap) / 2;
  let out = '';
  for (let i = 0; i < n; i++) out += `<text x="${start + i * gap}" y="8" font-size="14" text-anchor="middle">${emoji}</text>`;
  return out;
}

function shipGlyph(): string {
  return `<g fill="none" stroke="#eef4fa" stroke-width="2" stroke-linecap="round"><path d="M-10,6 q10,6 20,0 z"/><path d="M0,-8 v12 M0,-8 l7,5 h-7"/></g>`;
}
function castleGlyph(flag: string): string {
  return `<g fill="none" stroke="${flag}" stroke-width="2"><path d="M-8,9 v-12 h3 v3 h3 v-3 h4 v3 h3 v-3 h3 v12 z"/><path d="M0,-3 v-7" stroke-linecap="round"/><path d="M0,-10 l6,2 l-6,2 z" fill="${flag}"/></g>`;
}
function innGlyph(): string {
  return `<g fill="none" stroke="#f3e8f5" stroke-width="2" stroke-linecap="round"><path d="M-9,9 h18 M-7,9 v-8 l7,-6 l7,6 v8"/><circle cx="0" cy="4" r="1.6" fill="#f3e8f5" stroke="none"/></g>`;
}

/** 板块完整 SVG(置入公国格/补给区/储存格通用)——深色勾边+内缘高光,近似实体木片的厚度 */
export function tileSvg(t: Tile, size = HEX_H - 6): string {
  const scale = size / HEX_H;
  return `<g transform="scale(${scale.toFixed(3)})">${hexInner(t)}</g>`;
}

function hexInner(t: Tile): string {
  const pts = hexPoints(HEX_H);
  const ptsIn = hexPoints(HEX_H - 9);
  return `<polygon points="${pts}" fill="${COLOR_RIM[t.color]}"/>
    <polygon points="${hexPoints(HEX_H - 3)}" fill="${COLOR_HEX[t.color]}"/>
    <polygon points="${ptsIn}" fill="#ffffff" fill-opacity="0.10"/>
    ${tileGlyph(t)}`;
}

/** 公国格(底格:颜色+骰点,可放板块覆盖)——实色+白字黑晕,呼应实体版版图印字 */
export function boardCellSvg(color: TileColor, n: number, dim = false): string {
  const pts = hexPoints(HEX_H);
  const ptsIn = hexPoints(HEX_H - 9);
  return `<polygon points="${pts}" fill="${COLOR_RIM[color]}"/>
    <polygon points="${hexPoints(HEX_H - 3)}" fill="${COLOR_HEX[color]}" fill-opacity="${dim ? 0.3 : 0.92}"/>
    <polygon points="${ptsIn}" fill="#ffffff" fill-opacity="0.07"/>
    <text y="5.5" font-size="15" font-weight="700" fill="#fdf6e3" stroke="#000000" stroke-width="2.6"
      paint-order="stroke" stroke-linejoin="round" text-anchor="middle" fill-opacity="${dim ? 0.5 : 1}">${n}</text>
    ${color === 'red' ? `<g transform="scale(0.4) translate(0,16)" opacity="0.45">${castleGlyph('#fdf6e3')}</g>` : ''}`;
}

/** 骰子 SVG */
export function dieSvg(n: number, color: string, used = false): string {
  const dots = (k: number): [number, number][] => {
    const P: Record<number, [number, number][]> = {
      1: [[0, 0]], 2: [[-7, -7], [7, 7]], 3: [[-7, -7], [0, 0], [7, 7]],
      4: [[-7, -7], [7, -7], [-7, 7], [7, 7]], 5: [[-7, -7], [7, -7], [0, 0], [-7, 7], [7, 7]],
      6: [[-7, -7], [7, -7], [-7, 0], [7, 0], [-7, 7], [7, 7]],
    };
    return P[k] ?? [];
  };
  const d = dots(n).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#2c2420"/>`).join('');
  return `<rect x="-17" y="-17" width="34" height="34" rx="7" fill="#00000022" transform="translate(1.5,2)"/>
    <rect x="-16" y="-16" width="32" height="32" rx="7" fill="${used ? '#c9bfae' : color}" stroke="#2c2420" stroke-width="1.6"/>${d}`;
}

// ---- 货物(实体版:六色方片,各印奶酪/酒/香料/鱼/肉/麦图标与面值) ----

export const GOODS_HEX = ['#b7432e', '#8a2f58', '#c98a1e', '#5f8a3c', '#31708e', '#6b5a9e'];
export const GOODS_ICON = ['🧀', '🍷', '🧂', '🐟', '🍖', '🌾'];

/** 货物小方块:图标 + 数量(数量>1 时叠加计数) */
export function goodsSvg(colorIdx: number, count: number): string {
  const hue = GOODS_HEX[(colorIdx - 1) % 6];
  const icon = GOODS_ICON[(colorIdx - 1) % 6];
  return `<g><rect x="-12" y="-12" width="24" height="24" rx="4" fill="#00000033" transform="translate(1.5,1.5)"/>
    <rect x="-12" y="-12" width="24" height="24" rx="4" fill="${hue}" stroke="#241d18" stroke-width="1.2"/>
    <text y="6" font-size="15" text-anchor="middle">${icon}</text>
    ${count > 1 ? `<g><circle cx="10" cy="-9" r="9" fill="#fdf6e3" stroke="#241d18" stroke-width="1"/><text x="10" y="-5" font-size="11" font-weight="700" text-anchor="middle" fill="#241d18">${count}</text></g>` : ''}</g>`;
}

/** 货物片(带面值):补给区货物格/轮次货物堆用 */
export function goodsTileSvg(colorIdx: number, value: number, size = 26): string {
  const hue = GOODS_HEX[(colorIdx - 1) % 6];
  const icon = GOODS_ICON[(colorIdx - 1) % 6];
  return `<g><rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="4" fill="#00000033" transform="translate(1.5,1.5)"/>
    <rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="4" fill="${hue}" stroke="#241d18" stroke-width="1.2"/>
    <text y="${size * 0.22}" font-size="${size * 0.55}" text-anchor="middle">${icon}</text>
    <text x="${size / 2 - 2}" y="${-size / 2 + 6}" font-size="9" font-weight="700" text-anchor="end" fill="#fdf6e3" stroke="#241d18" stroke-width="2" paint-order="stroke">${value}</text></g>`;
}

// ---- 主板图组件 ----

/** 补给区骰点圆盘:双环 + 骰点(实体版花朵集群中央的编号盘) */
export function medallionSvg(n: number, r = 15, x = 0, y = 0): string {
  const P: Record<number, [number, number][]> = {
    1: [[0, 0]], 2: [[-5, -5], [5, 5]], 3: [[-6, -6], [0, 0], [6, 6]],
    4: [[-5, -5], [5, -5], [-5, 5], [5, 5]], 5: [[-5, -5], [5, -5], [0, 0], [-5, 5], [5, 5]],
    6: [[-5, -6], [5, -6], [-5, 0], [5, 0], [-5, 6], [5, 6]],
  };
  const dots = (P[n] ?? []).map(([dx, dy]) => `<circle cx="${dx}" cy="${dy}" r="2.6" fill="#fdf6e3"/>`).join('');
  return `<g transform="translate(${x},${y})"><circle r="${r}" fill="#4d3a2a"/><circle r="${r - 1.5}" fill="none" stroke="#c8a86a" stroke-width="1.4"/>
    <circle r="${r - 4.5}" fill="#5c1019"/>${dots}</g>`;
}

/** 花朵集群的 N 个六角位(围绕圆盘;7=中心+环,6=环,4=菱形,余类推) */
export function clusterPositions(n: number, step = 50): [number, number][] {
  if (n === 7) return [[0, -step * 1.5], [-step, -step * 0.75], [step, -step * 0.75], [-step, step * 0.75], [step, step * 0.75], [0, step * 1.5], [0, 0]];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    out.push([Math.cos(a) * step, Math.sin(a) * step * 0.92]);
  }
  return out;
}

/** 计分等通用小组件 */
export function playerBadge(g: GameState, idx: number): string {
  const p = g.players[idx];
  const rp = resP(g, idx);
  const teamTag = p.team ? `<i class="teamtag">${p.team}</i>` : '';
  return `<span class="pbadge" style="--pc:${p.color}">${teamTag}${escapeHtml(p.name)} · ${p.vp}分 · ${rp.workers}🛠 ${rp.silver}🪙</span>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
