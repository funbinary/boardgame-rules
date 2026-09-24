// SVG 渲染:六角网格、板块、骰子、货物。全部内联 SVG,无外部素材。
import type { GameState, Tile } from '../engine/state';
import type { TileColor } from '../engine/types';
import { resP } from '../engine/modules/team';

export const COLOR_HEX: Record<TileColor, string> = {
  yellow: '#e0b93c', blue: '#4a7ba6', red: '#8c2f39', gray: '#9a9a9a',
  green: '#6a9a58', brown: '#b98d5f', black: '#3a3a3a',
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
    case 'red': return castleGlyph('#f0d0a0');
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

/** 板块完整 SVG(置入公国格/补给区/储存格通用) */
export function tileSvg(t: Tile, size = HEX_H - 6): string {
  const scale = size / HEX_H;
  return `<g transform="scale(${scale.toFixed(3)})">${hexInner(t)}</g>`;
}

function hexInner(t: Tile): string {
  return `<polygon points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12" fill="${COLOR_HEX[t.color]}" stroke="#2c2420" stroke-width="1.5"/>${tileGlyph(t)}`;
}

/** 公国格(底格:颜色+骰点,可放板块覆盖) */
export function boardCellSvg(color: TileColor, n: number, dim = false): string {
  return `<polygon points="0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12"
      fill="${COLOR_HEX[color]}" fill-opacity="${dim ? 0.25 : 0.55}" stroke="#7c6a58" stroke-width="1"/>
    <text y="5" font-size="14" font-weight="600" fill="#2c2420" text-anchor="middle" fill-opacity="${dim ? 0.35 : 0.85}">${n}</text>`;
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
  return `<rect x="-16" y="-16" width="32" height="32" rx="7" fill="${used ? '#c9bfae' : color}" stroke="#2c2420" stroke-width="1.6"/>${d}`;
}

/** 货物小方块 */
export function goodsSvg(colorIdx: number, count: number): string {
  const hue = ['#a33', '#a73', '#7a3', '#3a7', '#36a', '#73a'][(colorIdx - 1) % 6];
  return `<rect x="-11" y="-11" width="22" height="22" rx="4" fill="${hue}" stroke="#2c2420" stroke-width="1"/><text y="5" font-size="12" fill="#fff" text-anchor="middle" font-weight="700">${count}</text>`;
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
