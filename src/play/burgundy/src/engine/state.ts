// 完整对局状态与走子(意图)类型。全部 JSON 可序列化。
import type { BuildingType, LivestockKind, ModuleId, TileColor } from './types';
import type { TradeReward } from './data';

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
  | 'workers2' | 'workers4' | 'silver2' | 'workers1' | 'silver1' | 'vp4' | 'vp2'
  | 'takeShipLivestock' | 'takeBuilding' | 'takeMineMonasteryCastle'
  | 'freeBlack' | 'freeTwin' | 'extraAction';   // workers4:2026-09-23 勘定,葡萄园版图格印「4+工人」

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
  /** 盾徽扩展:已拿盾徽列表(编号 1-18 = 效果号) */
  shields?: number[];
  /** 盾徽6:复制的目标玩家 idx */
  shieldTarget?: number;
  /** 商路扩展:商路格序列(自左而右)与已放置数;good=放置的货物点数(展示) */
  tradeRoute?: { n: number; reward: TradeReward; good?: number }[];
  tradeRoutePlaced?: number;
  /** 葡萄园扩展:玩家葡萄园版图状态(spaceId → 已放双生片) */
  vineyard?: {
    placed: Record<string, { tile: Tile; rot: 0 | 1 }>;
    bonusTiles: { type: string }[];
  };
  /** 自动机状态(见底部 AutomaState) */
  automa?: AutomaState;
  /** 第九扩展:所属队 'A'|'B'(2v2;共享资源在队锚点玩家上,见 engine/team.ts) */
  team?: 'A' | 'B';
}

/** 第九扩展:团队状态(2v2)。
 *  共享资源(工人/银币/货物/已售/奖励板块/公国 placed/修道院6号/初始城堡/版图号)
 *  全部挂在队锚点(members[0])玩家的对应字段上 —— 见 engine/modules/team.ts 的 resP 路由;
 *  TeamState 本身只承载无法归到单个玩家字段的东西(共享储存格)。 */
export interface TeamState {
  id: 'A' | 'B';
  /** 队员玩家 idx(锚点在前;座位 0,2 → A、1,3 → B) */
  members: number[];
  /** 共享储存格(2 格;每名队员另有 2 私人格在各 p.storage) */
  sharedStorage: (Tile | null)[];
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
  | { kind: 'marketTake' | 'carpenterTake' | 'churchTake' | 'tradeAnyTake'; player: number }   // tradeAnyTake=商路 takeAny:补给区任拿
  | { kind: 'warehouseSell'; player: number }
  | { kind: 'bonusAction'; player: number; from: 'castle' | 'cityhall' | 'whitecastle' | 'monastery' }
  | { kind: 'initialCastle'; player: number }
  | { kind: 'discardStorage'; player: number }                  // 储存满必须弃
  | { kind: 'sellColor'; player: number; colors: number[] }     // 仓库/自动机卖货选色
  | { kind: 'mon6Take'; player: number }
  // ---- 盾徽(P2) ----
  | { kind: 'shield5Take'; player: number }                     // 盾徽5:选货物色全取
  | { kind: 'shield6Target'; player: number }                   // 盾徽6:选复制目标玩家
  | { kind: 'freePlace'; player: number; from: 'depot' | 'black' } // 盾徽14/15:阶段末免费放置
  // ---- 葡萄园(P2) ----
  | { kind: 'freeBlackTake'; player: number }                   // 双生片奖励:黑区/商店免费拿
  | { kind: 'freeTwinTake'; player: number }                    // 双生片奖励:补给区免费拿双生片
  | { kind: 'vineCheck'; player: number; space: string }        // 放置后检查层完成(自动应答)
  | { kind: 'vineBonus'; player: number };                      // 层完成:选藤奖励板块

// ---------- 走子(意图) ----------

export type Move =
  // 基础四类行动(各耗 1 骰;die 指本回合第几颗骰 0/1;bonus=城堡/市政厅等额外行动自由点数)
  | { t: 'take'; die: 0 | 1 | 'bonus'; depot: number; cell: number; dieValue?: number }
  | { t: 'place'; die: 0 | 1 | 'bonus'; storage: number; r: number; c: number; dieValue?: number }
  | { t: 'sell'; die: 0 | 1 | 'bonus'; dieValue?: number }
  | { t: 'takeWorkers'; die: 0 | 1 | 'bonus'; dieValue?: number }
  // 骰子调整(非行动):花 1 工人 ±1(1↔6 环绕;修道院8 每 1 工人 ±2)
  | { t: 'modDie'; die: 0 | 1; delta: 1 | -1 | 2 | -2 }
  // 黑区购买(每回合一次,2 银币;葡萄园下 shop=true 改为购商店双生片)
  | { t: 'buyBlack'; cell: number; shop?: boolean }
  // 旅店(第六扩展):2 银币购旅店(与黑区购买共用每回合一次)
  | { t: 'buyInn' }
  // 盾徽(P2)
  | { t: 'takeShield'; depot: number; idx: number; replace?: number }   // 对子骰拿盾徽;replace=被替换盾徽下标
  | { t: 'takeShieldFree'; depot: number; idx: number; replace?: number } // 盾徽11:放城堡后免费拿(可跳过)
  | { t: 'skipShieldFree' }
  | { t: 'setDie'; die: 0 | 1; value: number }                          // 盾徽18:每回合一次改骰为任意点
  | { t: 'answerShield5'; color: number }
  | { t: 'answerShield6'; player: number }
  | { t: 'answerFreePlace'; from: 'depot' | 'black'; depot?: number; cell: number; r: number; c: number }
  | { t: 'skipFreePlace' }
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
  // 葡萄园(P2)
  | { t: 'takeTwin'; die: 0 | 1 | 'bonus'; slot: number; dieValue?: number }
  | { t: 'placeTwin'; die: 0 | 1 | 'bonus'; storage: number; space: string; rot: 0 | 1; dieValue?: number }
  | { t: 'answerFreeBlack'; source: 'black' | 'shop'; cell: number }
  | { t: 'answerFreeTwin'; slot: number }
  | { t: 'takeVineBonus'; type: string }
  // 自动机整回合(仅 isAutoma 玩家;引擎内部完成掷骰/检索/放置/奖励/买黑区全流程)
  | { t: 'automa' };

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
  /** 旅店堆(第六扩展):当前可购旅店数(每阶段开始 +1,共 5) */
  innPile: number;
  /** 边境哨所(第四扩展):2连/3连已触发玩家 */
  outpostClaims?: { done2: number[]; done3: number[] };
  /** 葡萄园扩展(M2b/P2):布袋/补给区槽/商店 */
  vineyard?: {
    bag: Tile[];
    supply: { ns: number[]; tile: Tile | null }[];
    shopSlots: (Tile | null)[];
    bonusPile: string[];
  };
  /** 阶段结算已执行(settle 与盾徽14/15免费放置的时序标记) */
  phaseSettled?: boolean;
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
    /** 盾徽11:放城堡后的免费拿盾徽机会(可放弃) */
    shield11Offer?: boolean;
    /** 盾徽18:本回合已用改骰 */
    shield18Used?: boolean;
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
  /** 自动机扩展状态(官方郡县卡流程) */
  automa?: AutomaState;
  /** 第九扩展:两队共享状态(2v2;存在时玩家资源路由见 engine/team.ts) */
  teams?: { A: TeamState; B: TeamState };
  /** 终局计分明细 */
  final?: { perPlayer: { idx: number; breakdown: { label: string; vp: number }[] }[] };
}

/** 郡县卡(数据来自 automa.json;filled=已放置板块) */
export interface AutomaCard {
  id: number;
  cells: { color: TileColor; sell?: boolean; twin?: boolean; castle?: boolean; filled?: Tile }[];
  scores: { easy: number; normal: number; hard: number };
}

export interface AutomaState {
  difficulty: 'easy' | 'normal' | 'hard';
  /** 难度修正 A/B/C/D */
  modifiers: string[];
  deck: AutomaCard[];
  cards: (AutomaCard | null)[];      // [左槽(骰1-4), 右槽(骰5-6)]
  reserve: Tile[];                   // 储备区;末位=同类顶部;black 面=百搭六角片
  silver: number;
  goods: number[];                   // [0]=弃用,[1..6]=各色货物数(无限堆)
  /** 公国溢出堆叠(同色格满后叠放,计入公国) */
  overflow: Tile[];
  /** 葡萄园:双生六角片(公国旁) */
  twins: Tile[];
  /** 盾徽扩展:已拿盾徽(不使用效果/不纳贡) */
  shields: number[];
  /** 出售货物行动次数(商路兼容:每次+1分) */
  sellActions: number;
}

export interface LogEntry { player?: number; text: string }
