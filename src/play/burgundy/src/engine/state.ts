// 完整对局状态与走子(意图)类型。全部 JSON 可序列化。
import type { BuildingType, LivestockKind, ModuleId, TileColor } from './types';

// ---------- 板块与货物 ----------

export interface Tile {
  id: number;               // 全局唯一实例 id(建局时分配)
  color: TileColor;
  black: boolean;           // 背面黑(从黑色补给区补/购买;正面效果照常)
  /** 修道院编号 1-29 */
  monastery?: number;
  building?: BuildingType;
  livestock?: LivestockKind;
  /** 牲畜只数 2-4 */
  animals?: number;
  /** 第五扩展:白色城堡 */
  whitecastle?: boolean;
  /** 第六扩展:旅店 */
  inn?: boolean;
  /** 第二扩展:鹅 */
  goose?: boolean;
  /** 葡萄园:双生六角片(占据 2 储存格) */
  twin?: { vines: [VineColor, VineColor]; bonus: [VineBonus, VineBonus] };
}

export type VineColor = 'red' | 'white' | 'yellow' | 'green' | 'blue' | 'purple';
export type VineBonus =
  | 'workers2' | 'silver2' | 'workers1' | 'silver1' | 'vp4' | 'vp2'
  | 'takeShipLivestock' | 'takeBuilding' | 'takeMineMonasteryCastle'
  | 'freeBlack' | 'freeTwin' | 'extraAction';

export interface GoodsTile { id: number; color: number; value: number } // color 1-6 ↔ 骰点

// ---------- 玩家 ----------

export interface PlayerState {
  idx: number;
  name: string;
  color: string;              // 'blue'|'red'|'green'|'yellow'(玩家颜色,显示用)
  boardId: number;            // 公国版图编号
  /** r*100+c → 已放置板块 */
  placed: Record<string, Tile>;
  /** 储存格(3 格;盾徽4号无限) */
  storage: (Tile | null)[];
  /** 货物储存(按颜色堆叠;至多 3 色) */
  goods: Record<number, GoodsTile[]>;
  workers: number;
  silver: number;
  vp: number;
  /** 已出售货物(商路扩展用) */
  soldGoods: GoodsTile[];
  /** 已获得奖励板块 [{color, value}] */
  bonusTiles: { color: TileColor; value: number }[];
  /** 修道院6号:本回合是否已用 */
  mon6Used: boolean;
  /** 是否自动机 */
  isAutoma: boolean;
  /** 本轮掷骰结果 */
  lastRoll?: [number, number];
  /** 初始城堡格 key(r:c) */
  castleCell?: string;
  /** 盾徽扩展:已拿盾徽列表 */
  shields?: number[];
  /** 商路扩展:商路格(点数序列)与已放置数 */
  tradeRoute?: number[];
  tradeRoutePlaced?: number;
  /** 葡萄园扩展:葡萄园版图状态 */
  vineyard?: { tiles: Tile[]; regions: { type: string; size: number }[]; bonusTiles: { type: string }[] };
  /** 自动机状态 */
  automa?: {
    deck: string[];                        // 郡县卡内容字符串数组(简化)
    hand: string[];
    countyCards: (string | null)[];        // 左右槽
    reserve: Tile[];
    silver: number;
    goods: number[];
    bonusTiles: { color: string; value: number }[];
    scoreModifier: 'easy' | 'normal' | 'hard';
  };
}

// ---------- 中央区域 ----------

export interface DepotState {
  n: number;                  // 1-6
  /** 格上板块;null=空。长度 = 该面格数 */
  cells: (Tile | null)[];
  /** 货物格上的货物 */
  goods?: GoodsTile;
  /** 盾徽扩展:该补给区的盾徽 */
  shields?: number[];
}

// ---------- 待决提示(板块效果链) ----------

export type PendingPrompt =
  | { kind: 'shipGoods'; player: number }                       // 选补给区拿货物
  | { kind: 'marketTake' | 'carpenterTake' | 'churchTake'; player: number }
  | { kind: 'warehouseSell'; player: number }
  | { kind: 'bonusAction'; player: number; from: 'castle' | 'cityhall' | 'whitecastle' | 'monastery' }
  | { kind: 'initialCastle'; player: number }
  | { kind: 'discardStorage'; player: number }                  // 储存满必须弃
  | { kind: 'sellColor'; player: number; colors: number[] }     // 仓库/自动机卖货选色
  | { kind: 'mon6Take'; player: number };

// ---------- 走子(意图) ----------

export type Move =
  // 基础四类行动(各耗 1 骰;die 指本回合第几颗骰 0/1;bonus=城堡/市政厅等额外行动自由点数)
  | { t: 'take'; die: 0 | 1 | 'bonus'; depot: number; cell: number; dieValue?: number }
  | { t: 'place'; die: 0 | 1 | 'bonus'; storage: number; r: number; c: number; dieValue?: number }
  | { t: 'sell'; die: 0 | 1 | 'bonus'; dieValue?: number }
  | { t: 'takeWorkers'; die: 0 | 1 | 'bonus' }
  // 骰子调整(非行动):花 1 工人 ±1(1↔6 环绕;修道院8 每 1 工人 ±2)
  | { t: 'modDie'; die: 0 | 1; delta: 1 | -1 | 2 | -2 }
  // 黑区购买(每回合一次,2 银币)
  | { t: 'buyBlack'; cell: number }
  // 效果链应答
  | { t: 'answerShipGoods'; depot: number }
  | { t: 'answerTake'; depot: number; cell: number }
  | { t: 'answerWarehouseSell'; color: number }
  | { t: 'answerBonusDie'; die: 0 | 1 }                          // 用哪颗骰执行奖励行动(bonus 槽)
  | { t: 'placeCastle'; r: number; c: number }                   // 建局初始城堡
  | { t: 'discardStorage'; slot: number }
  // 修道院
  | { t: 'mon6Buy'; depot: number; cell: number }                // 6号:花 2 工人拿建筑
  | { t: 'mon28BuyWorkers' }                                      // 28号:1 银币换 2 工人
  // 扩展
  | { t: 'takeTwin'; die: 0 | 1 | 'bonus'; slot: number }
  | { t: 'placeTwin'; die: 0 | 1 | 'bonus'; storage: number; r: number; c: number; rot: 0 | 1 };

// ---------- 对局状态 ----------

export interface GameState {
  v: number;
  seed: number;
  rng: { s: number };
  modules: ModuleId[];
  playerCount: number;
  players: PlayerState[];
  phase: number;               // 0..4 = A..E
  round: number;               // 1..5
  /** 各阶段货物堆(建局时定) */
  phasePools: GoodsTile[][];
  /** 白骰点数(轮次开始时掷) */
  whiteDie: number;
  /** 轮次格上剩余货物(底→顶);每轮开局取走底 1 个放到白骰补给区 */
  roundGoods: GoodsTile[];
  /** 6 个编号补给区 */
  depots: DepotState[];
  /** 黑色补给区 */
  blackDepot: (Tile | null)[];
  /** 旅店堆(第六扩展,黑区旁) */
  innPile: number;
  /** 未入袋供应计数(按颜色,供黑区补充等)——彩色面堆 */
  supply: Record<TileColor, number>;
  /** 本回合行动状态 */
  turn: {
    player: number;
    dice: [number, number];
    used: [boolean, boolean];
    /** 奖励行动自由点数(城堡/市政厅/白堡,每元素一次) */
    bonusDice: number[];
    blackBought: boolean;
    /** 本回合是否已放船/货物拿取等一次性标记 */
  };
  /** 回合顺位轨:spaces[spaceIdx] = 该格玩家(底→顶) */
  track: number[][];
  /** 待决提示栈(栈顶最后一个;UI 依此提问) */
  pending: PendingPrompt[];
  /** 奖励板块领取进度(颜色→已领人数) */
  rewardClaimed: Partial<Record<TileColor, number>>;
  /** 本轮已行动玩家 */
  roundPlayed: number[];
  status: 'placingCastles' | 'playing' | 'ended';
  log: LogEntry[];
  /** 版图区域缓存:每格所属区域 id(同色连通) —— 建局时算好 */
  regionOf: Record<string, number>;
  regions: { id: number; color: TileColor; cells: string[] }[];
  /** 自动机扩展状态(M2b) */
  automa?: { deck: number[]; hand: number[] };
  /** 葡萄园扩展状态(M2b) */
  vineyard?: { twinsSupply: Tile[]; shopSlots: (Tile | null)[] };
  /** 终局计分明细 */
  final?: { perPlayer: { idx: number; breakdown: { label: string; vp: number }[] }[] };
}

export interface LogEntry { player?: number; text: string }
