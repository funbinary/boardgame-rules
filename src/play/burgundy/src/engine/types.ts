// 勃艮第城堡(特别典藏版)引擎核心类型。
// 全部类型必须 JSON 可序列化 —— 状态要落 localStorage、要走联机 journal 重放。
// 颜色语义:yellow=修道院 blue=船 red=城堡(暗红) gray=银矿 green=牲畜 brown=建筑 black=黑色背面(百搭/黑市)

export type TileColor = 'yellow' | 'blue' | 'red' | 'gray' | 'green' | 'brown' | 'black';

export type BuildingType =
  | 'market'      // 市场:从任意补给区(非黑)拿 1 船或 1 牲畜
  | 'carpenter'   // 木工坊:拿 1 建筑
  | 'church'      // 教堂:拿 1 银矿/修道院/城堡
  | 'warehouse'   // 仓库:卖一种类型全部货物
  | 'dormitory'   // 宿舍:+4 工人
  | 'bank'        // 银行:+2 银币
  | 'cityhall'    // 市政厅:从储存格再放 1 块(任意点数骰子)
  | 'watchtower'  // 瞭望塔:+4 分
  | 'crane';      // 吊车(第二扩展):触发任意一种建筑效果

export type LivestockKind = 'chicken' | 'sheep' | 'cattle' | 'pig' | 'goose';

/** 公国版图上的一个六角格 */
export interface BoardCell {
  /** 网格行(0 起,自上而下) */
  r: number;
  /** 网格列(0 起,自左而右;尖顶六角奇偶行错半格) */
  c: number;
  color: TileColor;
  /** 骰点 1-6 */
  n: number;
  /** 边境哨所格(第四扩展版图 23-30) */
  outpost?: number;
  /** 自动机版图的特殊标记 */
  mark?: string;
}

/** 一张公国版图(双面版图的一面) */
export interface DuchyBoard {
  id: number;             // 1-10 基础;11-18 第一扩展;19-20 冠军赛;21-22 典藏专属;23-30 边境哨所;31/32 团队;33/34 单人;35/36 自动机
  name?: string;
  cells: BoardCell[];     // 共 37 格(团队版图 2×37;自动机版图另计)
  /** 额外公国版图(11-18)的"必须与城堡相连"可选规则适用 */
  castleRule?: boolean;
}

/** 中央主版图一个编号补给区 */
export interface DepotDef {
  /** 骰点 1-6 */
  n: number;
  /** 六角格(顺时针自顶部);only4=仅4人补充;threeBD=3人B/D阶段改补银矿 */
  cells: { color: TileColor; only4?: boolean; threeBD?: boolean }[];
  /** 货物格 */
  goods: boolean;
}

export interface CentralBoardDef {
  /** 3-4 人面 */
  front: { depots: DepotDef[]; blackDepotCells: number; twoPlayerBlackDepotCells: number };
}

/** 板块(六角片)种类定义 */
export interface TileKindDef {
  color: TileColor;
  /** 供应堆数量(彩色面/黑色面) */
  colored: number;
  black: number;
}

export interface BuildingTileDef { type: BuildingType; count: number; blackCount: number }
export interface LivestockTileDef { kind: LivestockKind; animals: number; count: number; blackCount?: number }

/** 修道院效果(1-29 号) */
export interface MonasteryDef {
  n: number;
  /** 生效时机 */
  when: 'ongoing' | 'onSell' | 'onShip' | 'onLivestock' | 'onBuild' | 'onMinePhaseEnd' | 'onPlace' | 'onTake' | 'onWorkers' | 'diceAdjust' | 'endgame';
  /** 效果参数(引擎解释) */
  effect: string;
  text: string;   // 规则书原文(简)
}

export type ModuleId =
  | 'exp1'        // 额外公国版图 11-18
  | 'exp2'        // 额外六角片(27/28 修道院+吊车+鹅)
  | 'exp3_7'      // 冠军赛版图 19-20
  | 'exp4'        // 边境哨所 23-30
  | 'exp5'        // 白色城堡
  | 'exp6'        // 旅店
  | 'exp8'        // 商路
  | 'exp9'        // 团队游戏
  | 'exp10'       // 单人游戏
  | 'shields'     // 盾徽
  | 'vineyard'    // 葡萄园
  | 'automa';     // 自动机
