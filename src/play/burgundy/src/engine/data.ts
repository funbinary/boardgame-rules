// 勃艮第引擎数据装载:读取 data/*.json 勘定数据;勘定未完成处提供兜底(带 TODO 标记)。
// 引擎绝不硬编码版面 —— 全部来自此处,便于数据替换后无需改代码。
import centralJson from './data/central.json';
import monasteriesJson from './data/monasteries.json';
import tilesJson from './data/tiles.json';
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
  cached.boards = { boards: [fallbackBoard()] };
  return cached.boards;
}

/** 兜底公国版图:37 格手工摆一张可玩布局(勘定数据 boards.json 目前全部占位,版图 1-10 逐格勘定未完成) */
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

// ---------- 兜底数据(勘定 JSON 落盘前的占位,保证引擎可开发可测) ----------

/** 兜底公国版图:37 格手工摆一张可玩布局(测试用;勘定数据到位后弃用) */
