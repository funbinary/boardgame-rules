// 建局:装配初始对局状态。随机性全部走 GameState.rng(可重放、联机一致)。
import { loadBoards, loadCentral, loadMonasteries, loadTiles } from './data';
import { randInt, rngInit, shuffle, type RngState } from './rng';
import { callModule, registerModule, type ModuleSetupOpts } from './modules';
import { innModule } from './modules/inn';
import { whitecastleModule } from './modules/whitecastle';
import { traderouteModule } from './modules/traderoute';
import { shieldsModule } from './modules/shields';
import { vineyardModule } from './modules/vineyard';
import { automaModule } from './modules/automa';
import type { DepotState, GameState, GoodsTile, PlayerState, Tile } from './state';
import type { BoardCell, DuchyBoard, ModuleId, TileColor } from './types';

// 注册全部模块钩子
registerModule('exp2', {} as never); // 额外六角片由 drawTile 直接处理
registerModule('exp5', whitecastleModule);
registerModule('exp6', innModule);
registerModule('exp8', traderouteModule);
registerModule('shields', shieldsModule);
registerModule('vineyard', vineyardModule);
registerModule('automa', automaModule);

export interface SetupOptions extends ModuleSetupOpts {
  seed: number;
  playerCount: number;                 // 2-4 真实玩家(自动机另算)
  modules?: ModuleId[];
  /** 指定各玩家公国版图(缺省随机) */
  boardIds?: number[];
  names?: string[];
}

const PLAYER_COLORS = ['#3f6fae', '#a8402f', '#3f7d43', '#b08030'];

/** 显式 rng 的板块抽取:按供应构成随机生成一个指定颜色的板块 */
export function drawTile(color: TileColor, black: boolean, rng: RngState, modules: ModuleId[]): [Tile, RngState] {
  const tiles = loadTiles();
  const t: Tile = { id: nextTileId(), color, black };
  let r = rng;
  const wcW = modules.includes('exp5') ? (color === 'brown' ? (black ? 3 : 4) : color === 'yellow' && !black ? 2 : 0) : 0;
  if (color === 'yellow') {
    const mons = loadMonasteries();
    const maxN = modules.includes('exp2') ? 29 : 26;
    const pool = mons.map((m) => m.n).filter((n) => n <= maxN);
    const [k, r1] = randInt(r, pool.length + wcW);
    r = r1;
    if (k < pool.length) t.monastery = pool[k];
    else t.whitecastle = true;                    // 第五扩展:白堡洗入黄色供应(占位配比)
  } else if (color === 'brown') {
    // 吊车(黑面,exp2);白色城堡(exp5)按其颜色构成并入
    const entries: { type: Tile['building']; w: number }[] =
      tiles.buildings.map((b) => ({ type: b.type as Tile['building'], w: black ? b.blackCount : b.count }));
    if (black && modules.includes('exp2')) entries.push({ type: 'crane', w: 1 });
    const total = entries.reduce((s, e) => s + e.w, 0) + wcW;
    const [k, r1] = randInt(r, total);
    r = r1;
    if (k >= total - wcW) t.whitecastle = true;   // 第五扩展:白堡洗入浅褐/黑色供应(占位配比 4彩/3黑)
    else {
      let acc = 0;
      for (const e of entries) {
        acc += e.w;
        if (k < acc) { t.building = e.type; break; }
      }
    }
  } else if (color === 'green') {
    const lv = tiles.livestock;
    const total = lv.reduce((s, l) => s + l.count, 0);
    const [k, r1] = randInt(r, total);
    r = r1;
    let acc = 0;
    for (const l of lv) {
      acc += l.count;
      if (k < acc) { t.livestock = l.kind as Tile['livestock']; t.animals = l.animals; break; }
    }
  }
  return [t, r];
}

let tileId = 1;
export function nextTileId(): number { return tileId++; }
/** 测试隔离:重置实例 id */
export function resetIdsForTest(): void { tileId = 1; goodsId = 1; }

export function createGame(opts: SetupOptions): GameState {
  resetIdsForTest();
  const central = loadCentral();
  const boards = loadBoards();
  const tiles = loadTiles();
  const modules = opts.modules ?? [];
  const playerCount = opts.playerCount;
  let rng: RngState = rngInit(opts.seed);

  // ---- 货物牌堆:洗混后 25 个进 5 个阶段堆,每人 3 个起始货物 ----
  const goodsTiles = makeGoods(tiles);
  const [shuffledGoods, r0] = shuffle(rng, goodsTiles);
  rng = r0;
  const phasePools = [
    shuffledGoods.slice(0, 5), shuffledGoods.slice(5, 10), shuffledGoods.slice(10, 15),
    shuffledGoods.slice(15, 20), shuffledGoods.slice(20, 25),
  ];
  let gi = 25;

  // ---- 玩家 ----
  const usableBoards = boards.boards.filter((b) => b.cells.length > 0);
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    let boardId = opts.boardIds?.[i];
    if (boardId == null) {
      const [k, r] = randInt(rng, usableBoards.length || 1);
      rng = r;
      boardId = usableBoards[k]?.id ?? usableBoards[0]?.id ?? 0;
    }
    const p: PlayerState = {
      idx: i,
      name: opts.names?.[i] ?? `玩家${i + 1}`,
      color: PLAYER_COLORS[i % 4],
      boardId,
      placed: {},
      storage: [null, null, null],
      goods: {},
      workers: 0,
      silver: 1,
      vp: 0,
      soldGoods: [],
      bonusTiles: [],
      mon6Used: false,
      isAutoma: false,
    };
    for (let k = 0; k < 3; k++) {
      const g = shuffledGoods[gi++];
      (p.goods[g.color] ??= []).push(g);
    }
    players.push(p);
  }

  // ---- 供应堆(仅计数,用于校验) ----
  const supply: Record<TileColor, number> = {
    yellow: tiles.monasteries.colored, blue: tiles.ships.colored, red: tiles.castles.colored,
    gray: tiles.mines.colored, green: tiles.livestock.reduce((s, l) => s + l.count, 0),
    brown: tiles.buildings.reduce((s, b) => s + b.count, 0), black: 0,
  };

  // ---- 起始玩家(掷骰决定)与工人分配;自动机模块下末位玩家是自动机,不参与起始掷骰 ----
  const startPool = modules.includes('automa') ? playerCount - 1 : playerCount;
  const [startIdx, r1] = randInt(rng, Math.max(1, startPool));
  rng = r1;
  players.forEach((p, i) => { p.workers = ((i - startIdx + playerCount) % playerCount) + 1; });
  // 轨:末位玩家先放,起始玩家在最顶
  const stack: number[] = [];
  for (let k = playerCount - 1; k >= 1; k--) stack.push((startIdx + k) % playerCount);
  stack.push(startIdx);

  const face = playerCount >= 3 ? central.front : (central.back ?? central.front);
  const depots: DepotState[] = face.depots.map((d) => ({ n: d.n, cells: d.cells.map(() => null) }));

  const g: GameState = {
    v: 1,
    seed: opts.seed,
    rng,
    modules,
    playerCount,
    players,
    phase: 0,
    round: 1,
    phasePools,
    roundGoods: [],
    whiteDie: 0,
    depots,
    blackDepot: [],
    innPile: 0,
    supply,
    turn: { player: startIdx, dice: [1, 1], used: [false, false], bonusDice: [], blackBought: false },
    track: [stack],
    pending: [],
    rewardClaimed: {},
    roundPlayed: [],
    status: 'placingCastles',
    log: [{ text: `对局建立 seed=${opts.seed} 玩家=${playerCount} 模块=[${modules.join(',') || '基础'}]` }],
    regionOf: {},
    regions: [],
  };

  // 模块建局钩子(透传配置;自动机钩子会改末位玩家状态/顺位)
  const moduleOpts: ModuleSetupOpts = { automa: opts.automa };
  for (const m of modules) {
    callModule(m, g, 'onSetup', moduleOpts);
  }

  // 初始城堡:每人待决(从起始玩家开始;自动机不设初始城堡——城堡在郡县卡上)
  for (let k = playerCount - 1; k >= 0; k--) {
    const pi = (startIdx + k) % playerCount;
    if (!players[pi].isAutoma) g.pending.push({ kind: 'initialCastle', player: pi });
  }

  beginPhase(g);
  rollRound(g);
  g.log.push({ text: `起始玩家:${players[startIdx].name}` });
  return g;
}

let goodsId = 1;
function makeGoods(t: ReturnType<typeof loadTiles>): GoodsTile[] {
  const out: GoodsTile[] = [];
  for (let color = 1; color <= t.goods.colors; color++) {
    for (const v of t.goods.valuesPerColor) out.push({ id: goodsId++, color, value: v });
  }
  return out;
}

/** 阶段开始(含阶段A):补给区按格色补板块(考虑 4/3BD 标记)、补黑区、轮次货物上桌 */
export function beginPhase(g: GameState) {
  const central = loadCentral();
  const tiles = loadTiles();
  const face = g.playerCount >= 3 ? central.front : (central.back ?? central.front);
  let r = g.rng;
  for (let d = 0; d < g.depots.length; d++) {
    const def = face.depots[d];
    g.depots[d].cells = def.cells.map((cell) => {
      const spec = cell as { color: TileColor; only4?: boolean; threeBD?: boolean } | TileColor;
      const color = typeof spec === 'string' ? spec : spec.color;
      const only4 = typeof spec === 'object' && spec.only4;
      const threeBD = typeof spec === 'object' && spec.threeBD;
      if (only4 && g.playerCount < 4) return null;
      if (threeBD && g.playerCount === 3 && (g.phase === 1 || g.phase === 3)) {
        const [t, nr] = drawTile('gray', false, r, g.modules);
        r = nr;
        return t;
      }
      const [t, nr] = drawTile(color, false, r, g.modules);
      r = nr;
      return t;
    });
  }
  // 黑区:按各色 black 构成随机(exp5 白堡黑面占位 3 张并入褐桶)
  const exp5 = g.modules.includes('exp5');
  const blackPool: { color: TileColor; w: number }[] = [
    { color: 'yellow', w: tiles.monasteries.black },
    { color: 'blue', w: tiles.ships.black },
    { color: 'red', w: tiles.castles.black },
    { color: 'gray', w: tiles.mines.black },
    { color: 'green', w: tiles.livestock.reduce((s, l) => s + (l.blackCount ?? 0), 0) },
    { color: 'brown', w: tiles.buildings.reduce((s, b) => s + b.blackCount, 0) + (exp5 ? 3 : 0) },
  ];
  const total = blackPool.reduce((s, e) => s + e.w, 0);
  const blackCount = face.blackDepotCells;
  g.blackDepot = [];
  for (let i = 0; i < blackCount; i++) {
    const [k, nr] = randInt(r, total);
    r = nr;
    let acc = 0;
    for (const e of blackPool) {
      acc += e.w;
      if (k < acc) {
        const [t, nr2] = drawTile(e.color, true, r, g.modules);
        r = nr2;
        g.blackDepot.push(t);
        break;
      }
    }
  }
  g.rng = r;
  g.roundGoods = g.phasePools[g.phase].slice();
}

/** 轮次开始:全员掷骰,起始玩家另掷白骰并把轮次格底货物放到白骰补给区 */
export function rollRound(g: GameState) {
  let r = g.rng;
  for (const p of g.players) {
    const [d1, r1] = randInt(r, 6);
    const [d2, r2] = randInt(r1, 6);
    r = r2;
    if (p.idx === g.turn.player) g.turn.dice = [d1 + 1, d2 + 1];
    // 其他玩家的骰子在 flow 切换回合时重掷? —— 规则:每轮所有玩家同时掷骰。
    // 存储设计:g.players[].lastRoll
    p.lastRoll = [d1 + 1, d2 + 1];
  }
  const [w, r3] = randInt(r, 6);
  r = r3;
  const white = w + 1;
  g.whiteDie = white;
  // 底部货物(数组头)放到白骰对应补给区
  const goods = g.roundGoods.shift();
  if (goods) {
    const depot = g.depots[white - 1];
    depot.goods = goods;
  }
  g.rng = r;
  // 本轮当前行动者 = 轨最前玩家
  g.turn.player = trackOrder(g)[0];
  const first = g.players[g.turn.player];
  g.turn.dice = [...first.lastRoll!] as [number, number];
  g.turn.used = [false, false];
  g.turn.bonusDice = [];
  g.turn.blackBought = false;
  g.log.push({ text: `阶段${'ABCDE'[g.phase]} 轮次${g.round}:白骰=${white},顺位=${g.players[trackOrder(g)[0]].name}` });
}

/** 回合顺位:格大者优先,同格栈顶优先 */
export function trackOrder(g: GameState): number[] {
  const out: number[] = [];
  for (let i = g.track.length - 1; i >= 0; i--) {
    const stack = g.track[i];
    for (let j = stack.length - 1; j >= 0; j--) out.push(stack[j]);
  }
  return out;
}

// ---------- 区域(牧场/城镇/同色区)预计算 ----------

const allRegionsCache = new Map<number, {
  regionOf: Record<string, number>;
  regions: { id: number; color: TileColor; cells: string[] }[];
}>();

export function regionsOf(boardId: number) {
  if (!allRegionsCache.has(boardId)) {
    const b = loadBoards().boards.find((x) => x.id === boardId);
    if (b) allRegionsCache.set(boardId, computeRegions(b));
  }
  return allRegionsCache.get(boardId)!;
}

/** 尖顶六角邻接:偶数行 [(-1,-1),(-1,0),(0,-1),(0,1),(1,-1),(1,0)],奇数行右移半格 */
export function neighborsOf(cell: { r: number; c: number }, all: { r: number; c: number }[]): { r: number; c: number }[] {
  const even = cell.r % 2 === 0;
  const dirs = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  return all.filter((o) => dirs.some(([dr, dc]) => o.r === cell.r + dr && o.c === cell.c + dc));
}

export function computeRegions(b: DuchyBoard) {
  const regionOf: Record<string, number> = {};
  const regions: { id: number; color: TileColor; cells: string[] }[] = [];
  let next = 0;
  for (const cell of b.cells) {
    const key = `${cell.r}:${cell.c}`;
    if (regionOf[key] != null) continue;
    const id = next++;
    const stack: BoardCell[] = [cell];
    const group: string[] = [];
    regionOf[key] = id;
    while (stack.length) {
      const cur = stack.pop()!;
      group.push(`${cur.r}:${cur.c}`);
      for (const nb of neighborsOf(cur, b.cells)) {
        const nk = `${nb.r}:${nb.c}`;
        if (regionOf[nk] == null && b.cells.find((x) => x.r === nb.r && x.c === nb.c)?.color === cell.color) {
          regionOf[nk] = id;
          stack.push(b.cells.find((x) => x.r === nb.r && x.c === nb.c)!);
        }
      }
    }
    regions.push({ id, color: cell.color, cells: group });
  }
  return { regionOf, regions };
}
