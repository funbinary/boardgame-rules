// 勃艮第引擎数据装载:读取 data/*.json 勘定数据;勘定未完成处提供兜底(带 TODO 标记)。
// 引擎绝不硬编码版面 —— 全部来自此处,便于数据替换后无需改代码。
import centralJson from './data/central.json';
import boardsJson from './data/boards.json';
import monasteriesJson from './data/monasteries.json';
import tilesJson from './data/tiles.json';
import automaJson from './data/automa.json';
import tradeJson from './data/traderoute.json';
import vineyardJson from './data/vineyard.json';
import type { CentralBoardDef, DuchyBoard, TileColor } from './types';

export interface CentralFace {
  depots: CentralBoardDef['front']['depots'];
  blackDepotCells: number;
}
export interface CentralData { front: CentralFace; back: CentralFace }
export interface BoardsData { boards: DuchyBoard[] }
export interface TilesData {
  buildings: { type: string; count: number; blackCount: number }[];
  livestock: { kind: string; animals: number; count: number; blackCount?: number }[];
  mines: { colored: number; black: number };
  ships: { colored: number; black: number };
  monasteries: { colored: number; black: number };
  castles: { colored: number; black: number };
  goods: { colors: number; perColor: number; valuesPerColor: number[] };
  [k: string]: unknown;
}
export interface MonasteryItem { n: number; when: string; effect: string; text: string }

let cached: {
  central?: CentralData;
  boards?: BoardsData;
  tiles?: TilesData;
  monasteries?: MonasteryItem[];
} = {};

export function loadCentral(): CentralData {
  if (cached.central) return cached.central;
  const raw = centralJson.data as unknown as {
    front: CentralFace;
    back?: Partial<CentralFace> & { depots?: { n: number; cells: unknown[] }[] };
  };
  const front: CentralFace = {
    depots: raw.front.depots,
    blackDepotCells: raw.front.blackDepotCells ?? 6,
  };
  // 2 人面勘定缺失时的临时策略:暂用正面布局(黑区用 2 人格数 4),
  // 官方仅"每区块数更少",数据落盘后自动生效。
  const backCellsUsable = !!raw.back?.depots?.length && raw.back.depots.every((d) => d.cells.length > 0);
  const back: CentralFace = backCellsUsable
    ? { depots: raw.back!.depots as CentralFace['depots'], blackDepotCells: raw.back?.blackDepotCells ?? 4 }
    : { depots: front.depots, blackDepotCells: raw.back?.blackDepotCells ?? 4 };
  cached.central = { front, back };
  return cached.central;
}

export function loadBoards(): BoardsData {
  if (cached.boards) return cached.boards;
  const raw = (boardsJson as unknown as { data: BoardsData }).data;
  const usable = raw.boards.filter((b) => b.cells.length > 0);
  cached.boards = usable.length ? { boards: usable } : { boards: [fallbackBoard()] };
  return cached.boards;
}

/** 兜底公国版图:37 格手工摆一张可玩布局(仅当 boards.json 全占位时使用;勘定数据已落盘,保留供测试) */
export function fallbackBoard(): DuchyBoard {
  const rows: [TileColor, number][][] = [
    [['gray', 1], ['yellow', 2], ['green', 3], ['brown', 4]],
    [['red', 5], ['yellow', 6], ['green', 1], ['blue', 2], ['brown', 3]],
    [['brown', 4], ['green', 5], ['red', 6], ['yellow', 1], ['blue', 2], ['gray', 3]],
    [['blue', 4], ['brown', 5], ['green', 6], ['yellow', 1], ['gray', 2], ['red', 3], ['yellow', 4]],
    [['gray', 5], ['blue', 6], ['brown', 1], ['green', 2], ['red', 3], ['yellow', 4]],
    [['green', 5], ['yellow', 6], ['blue', 1], ['gray', 2], ['brown', 3]],
    [['brown', 4], ['green', 5], ['yellow', 6], ['blue', 1]],
  ];
  const cells: DuchyBoard['cells'] = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const [color, n] = rows[r][c];
      cells.push({ r, c, color, n });
    }
  }
  return { id: 0, cells, name: 'FALLBACK' };
}

export function loadTiles(): TilesData {
  if (cached.tiles) return cached.tiles;
  const t = tilesJson.data as unknown as TilesData;
  cached.tiles = t;
  return cached.tiles;
}

export function loadMonasteries(modules: string[] = []): MonasteryItem[] {
  const all = (monasteriesJson.data as unknown as MonasteryItem[]).slice();
  if (!modules.includes('exp2')) return all.filter((m) => m.n <= 26);
  return all;
}

// ---- 商路数据(8th 扩展;占位见 traderoute.json _meta) ----

export type TradeReward =
  | 'workers4' | 'workers2' | 'silver2' | 'silver1' | 'vp4' | 'vp2'
  | 'takeBuilding' | 'takeShipLivestock' | 'takeMineMonasteryCastle'
  | 'takeAny';   // 六色条纹钥匙格:从补给区任拿 1 块(2026-09-23 勘定新增)

export interface TradeRouteData {
  tiles: { id: number; spaces: { n: number; reward: TradeReward }[] }[];
}

let cachedTrade: TradeRouteData | undefined;
export function loadTradeRoutes(): TradeRouteData {
  if (!cachedTrade) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedTrade = (tradeJson as unknown as { data: TradeRouteData }).data;
  }
  return cachedTrade!;
}

// ---- 葡萄园数据(占位见 vineyard.json _meta) ----

export interface VineyardData {
  board: {
    layers: number; spacesPerLayer: number;
    /** 官方版图勘定后:显式空间表(缺省时用 layers×spacesPerLayer 占位公式) */
    spaces?: { layer: number; slot: number; n: number; id?: string; hexes?: [string, string]; bonuses?: string[] }[];
  };
  supplyNums: { p2: number[][]; p3: number[][]; p4: number[][] };
  shopSlots: { p2: number; p3: number; p4: number };
  bagCount: number;
  /** 官方 51 片构成(high):6 纯色各 1 + 15 混色各 3;缺省时均匀随机占位 */
  bagComposition?: { pureColors: string[]; pureEach?: number; mixedEach?: number; bonus?: [string, string] };
  bonusTypes: string[];
  bonusPerType: number;
  twinScores: number[];
}

let cachedVineyard: VineyardData | undefined;
export function loadVineyardData(): VineyardData {
  if (!cachedVineyard) cachedVineyard = (vineyardJson as unknown as { data: VineyardData }).data;
  return cachedVineyard!;
}

/** 葡萄园版图空间(占位布局:4 层×3 片,每片 2 格) */
export interface VineyardSpace {
  id: string;           // `L{layer}S{slot}`
  layer: number;        // 0=底层(首片必须放这层)
  slot: number;         // 层内序号
  n: number;            // 放置所需骰点
  hexes: [string, string]; // 两格 key(`r:c`)
  /** 该放置位两格上印的奖励行动(官方:奖励印在版图格,不在片上;缺省回退片上 bonus) */
  bonuses?: VineyardData['bagComposition'] extends object ? string[] : string[];
}

/** 空间布局与相邻关系(同层左右相邻 + 跨层 ±1 相邻;占位几何) */
export function vineyardSpaces(): VineyardSpace[] {
  const bd = loadVineyardData().board;
  if (bd.spaces?.length) {
    return bd.spaces.map((s) => ({
      id: s.id ?? `L${s.layer}S${s.slot}`, layer: s.layer, slot: s.slot, n: s.n,
      hexes: s.hexes ?? [`${s.layer}:${s.slot * 2}`, `${s.layer}:${s.slot * 2 + 1}`],
      bonuses: s.bonuses as VineyardSpace['bonuses'],
    }));
  }
  const { layers, spacesPerLayer } = bd;
  const out: VineyardSpace[] = [];
  for (let L = 0; L < layers; L++) {
    for (let s = 0; s < spacesPerLayer; s++) {
      // 骰点占位:底层 1/4 交替,其余层 (L+s)%6+1
      out.push({
        id: `L${L}S${s}`, layer: L, slot: s,
        n: L === 0 ? (s % 2 === 0 ? 1 : 4) : ((L + s) % 6) + 1,
        hexes: [`${L}:${s * 2}`, `${L}:${s * 2 + 1}`],
      });
    }
  }
  return out;
}

/** 两空间的藤是否可能相邻:返回 (hexAIdx, hexBIdx) 接触对(占位:左↔右/下↔上) */
export function vineyardLinkPairs(): { a: string; ah: 0 | 1; b: string; bh: 0 | 1 }[] {
  const spaces = vineyardSpaces();
  const perLayer = loadVineyardData().board.spacesPerLayer;
  const out: { a: string; ah: 0 | 1; b: string; bh: 0 | 1 }[] = [];
  for (const s of spaces) {
    // 同层:右格 ↔ 右邻空间左格
    if (s.slot + 1 < perLayer) out.push({ a: s.id, ah: 1, b: `L${s.layer}S${s.slot + 1}`, bh: 0 });
    // 跨层:右格 ↔ 下一层同列/右列空间左格(占位)
    for (const t of spaces) {
      if (t.layer !== s.layer + 1) continue;
      if (t.slot === s.slot || t.slot === s.slot + 1) out.push({ a: s.id, ah: 1, b: t.id, bh: 0 });
    }
  }
  return out;
}

// ---- 自动机数据(郡县卡/储备区类型序/双生片/盾徽计分表) ----

export interface AutomaCardDef {
  id: number;
  cells: { color: TileColor; sell?: boolean; twin?: boolean; castle?: boolean }[];
  scores: { easy: number; normal: number; hard: number };
}

export interface AutomaData {
  countyCards: AutomaCardDef[];
  vineyardCountyCards: AutomaCardDef[];
  twinScores: number[];
  shieldScores: number[];
  reserveTypeOrder: TileColor[];
}

let cachedAutoma: AutomaData | undefined;
export function loadAutoma(): AutomaData {
  if (!cachedAutoma) cachedAutoma = (automaJson as unknown as { data: AutomaData }).data;
  return cachedAutoma;
}
