// P2 扩展模块测试:旅店/商路/盾徽/葡萄园/边境哨所。
// 受控用例直接改状态(参照 automa.test.ts 惯例)。注意:applyMove 返回新状态(深克隆),
// 断言前必须重新读取 g.players[i];纯函数(纳贡/区域计分)直接单测。
import { describe, expect, it } from 'vitest';
import { autopilotPick } from '../src/ai/autopilot';
import { hashState } from '../src/engine/hash';
import { applyMove, legalMoves, MoveError } from '../src/engine/moves';
import { createGame } from '../src/engine/setup';
import { loadBoards, vineyardSpaces } from '../src/engine/data';
import { endgameScore, PHASE_BONUS, regionCompleteVP, SIZE_VP } from '../src/engine/scoring';
import { shieldsTribute } from '../src/engine/modules/shields';
import { vineyardRegions } from '../src/engine/modules/vineyard';
import { outpostComponents, outpostsCheck } from '../src/engine/modules/outposts';
import type { DuchyBoard } from '../src/engine/types';
import type { GameState, Move, Tile, VineBonus, VineColor } from '../src/engine/state';

/** 完整跑一局(autopilot 代走;可指定模块) */
function playFull(seed: number, playerCount: number, modules: string[], salt = 0): { journal: Move[]; final: GameState } {
  let g = createGame({ seed, playerCount, modules: modules as GameState['modules'] });
  const journal: Move[] = [];
  let guard = 60000;
  while (g.status !== 'ended' && guard-- > 0) {
    const m = autopilotPick(g);
    if (!m) throw new Error(`死局:${JSON.stringify({ s: g.status, p: g.pending.at(-1), t: g.turn })}`);
    journal.push(m);
    g = applyMove(g, m);
  }
  if (guard <= 0) throw new Error('未在步数上限内结束');
  return { journal, final: g };
}

/** 进入 playing 态(放完所有初始城堡) */
function startPlaying(g: GameState): GameState {
  let guard = 10;
  while (g.status === 'placingCastles' && guard-- > 0) {
    const m = legalMoves(g).find((x) => x.t === 'placeCastle');
    if (!m) break;
    g = applyMove(g, m);
  }
  return g;
}

const inn = (id: number): Tile => ({ id, color: 'black', black: true, inn: true });
const twin = (id: number, vines: [VineColor, VineColor], bonus: [VineBonus, VineBonus]): Tile =>
  ({ id, color: 'green', black: false, twin: { vines, bonus } });

// ================= 旅店 =================
describe('旅店(第六扩展)', () => {
  it('建局:阶段A开始旅店堆=1;购买入储存格且每回合一次', () => {
    let g = createGame({ seed: 11, playerCount: 2, modules: ['exp6'] });
    expect(g.innPile).toBe(1);
    g = startPlaying(g);
    const pi = g.turn.player;
    g.players[pi].silver = 5;
    g = applyMove(g, { t: 'buyInn' });
    expect(g.innPile).toBe(0);
    expect(g.players[pi].silver).toBe(3);
    expect(g.players[pi].storage.some((s) => s?.inn)).toBe(true);
    expect(() => applyMove(g, { t: 'buyInn' })).toThrow(MoveError);
  });

  it('旅店可放任意色格(骰点/邻接照常);同区域限 1 座', () => {
    let g = startPlaying(createGame({ seed: 12, playerCount: 2, modules: ['exp6'] }));
    const pi = g.turn.player;
    let p = g.players[pi];
    const board = loadBoards().boards.find((b) => b.id === p.boardId)!;
    p.storage[0] = inn(9901);
    const dirs = (r: number) => r % 2 === 0
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    const [cr, cc] = p.castleCell!.split(':').map(Number);
    const target = board.cells.find((c) => !p.placed[`${c.r}:${c.c}`] &&
      dirs(c.r).some(([dr, dc]) => c.r === cr + dr && c.c === cc + dc))!;
    expect(target).toBeDefined();
    g.turn.dice = [target.n, target.n === 6 ? 1 : target.n + 1];
    g = applyMove(g, { t: 'place', die: 0, storage: 0, r: target.r, c: target.c });
    p = g.players[pi];
    expect(p.placed[`${target.r}:${target.c}`]?.inn).toBe(true);
    // 同区域第二座被拒
    p.storage[0] = inn(9902);
    expect(() => applyMove(g, { t: 'place', die: 1, storage: 0, r: target.r, c: target.c })).toThrow(MoveError);
  });

  it('旅店/盾徽16 令完成区域规模+1(regionCompleteVP 单测)', () => {
    const g = startPlaying(createGame({ seed: 13, playerCount: 2, modules: ['exp6'] }));
    const p = g.players[0];
    const cells = ['0:0', '0:1'];
    // 基准:规模2 = 3 + 阶段A 10
    expect(regionCompleteVP(g, 0, cells, 'gray')).toBe(SIZE_VP[2] + PHASE_BONUS[0]);
    // 旅店在区域内 → 规模3
    p.placed['0:0'] = { ...inn(1) };
    expect(regionCompleteVP(g, 0, cells, 'gray')).toBe(SIZE_VP[3] + PHASE_BONUS[0]);
    // +盾徽16 → 规模4
    p.shields = [16];
    expect(regionCompleteVP(g, 0, cells, 'gray')).toBe(SIZE_VP[4] + PHASE_BONUS[0]);
  });
});

// ================= 商路 =================
describe('商路(第八扩展)', () => {
  it('每人获得商路格(2人=15格);出售货物上格并按点数领奖', () => {
    let g = startPlaying(createGame({ seed: 21, playerCount: 2, modules: ['exp8'] }));
    const pi = g.turn.player;
    let p = g.players[pi];
    expect(p.tradeRoute!.length).toBe(15);
    p.tradeRoute = [{ n: 3, reward: 'silver2' }, { n: 1, reward: 'workers4' }, { n: 6, reward: 'vp2' }];
    p.tradeRoutePlaced = 0;
    const mk = (v: number) => ({ id: 7000 + v, color: 3, value: v });
    p.goods[3] = [mk(3), mk(3), mk(3)];   // 骰点3 卖 3 色(值都是3)
    g.turn.dice = [3, 3];
    const silver0 = p.silver;
    g = applyMove(g, { t: 'sell', die: 0 });
    p = g.players[pi];
    // 3 枚货物全部上格(值3:匹配格0;格1/2 不匹配)
    expect(p.tradeRoutePlaced).toBe(3);
    expect(p.tradeRoute![0].good).toBe(3);
    expect(p.silver).toBe(silver0 + 1 + 2);       // 基础1银 + 商路 silver2
    // 商路已满 → 再卖进已售堆
    p.goods[2] = [{ id: 7100, color: 2, value: 2 }];
    g.turn.dice = [2, 2];
    g.turn.used = [false, true];
    const sold0 = p.soldGoods.length;
    g = applyMove(g, { t: 'sell', die: 0 });
    p = g.players[pi];
    expect(p.soldGoods.length).toBe(sold0 + 1);
  });


  it('商路 takeAny(2026-09-23 勘定):出售上格 → 补给区任拿 1 块待决', () => {
    let g = startPlaying(createGame({ seed: 23, playerCount: 2, modules: ['exp8'] }));
    const pi = g.turn.player;
    let p = g.players[pi];
    p.tradeRoute = [{ n: 2, reward: 'takeAny' }];
    p.tradeRoutePlaced = 0;
    p.goods[2] = [{ id: 7200, color: 2, value: 2 }];
    g.turn.dice = [2, 2];
    g = applyMove(g, { t: 'sell', die: 0 });
    p = g.players[pi];
    expect(p.tradeRoutePlaced).toBe(1);
    expect(g.pending[g.pending.length - 1].kind).toBe('tradeAnyTake');
    // 枚举:任意补给区板块可选
    const opts = legalMoves(g).filter((m) => m.t === 'answerTake');
    expect(opts.length).toBeGreaterThan(0);
    const m0 = opts[0] as Extract<Move, { t: 'answerTake' }>;
    const dep = g.depots[m0.depot - 1];
    expect(dep.cells[m0.cell]).toBeTruthy();
    const n0 = p.storage.filter((s) => s == null).length;
    g = applyMove(g, m0);
    p = g.players[pi];
    expect(p.storage.filter((s) => s == null).length).toBe(n0 - 1);
    expect(g.pending.length).toBe(0);
  });

  it('商路奖励:工人/分数', () => {
    let g = startPlaying(createGame({ seed: 22, playerCount: 2, modules: ['exp8'] }));
    const pi = g.turn.player;
    let p = g.players[pi];
    p.tradeRoute = [{ n: 2, reward: 'workers4' }, { n: 5, reward: 'vp4' }, { n: 5, reward: 'silver1' }];
    p.tradeRoutePlaced = 0;
    p.goods[2] = [{ id: 8001, color: 2, value: 2 }, { id: 8002, color: 2, value: 5 }];
    g.turn.dice = [2, 1];
    const vp0 = p.vp;
    const workers0 = p.workers;
    const silver0 = p.silver;
    g = applyMove(g, { t: 'sell', die: 0 });
    p = g.players[pi];
    expect(p.workers).toBe(workers0 + 4);          // 第1枚 2→2 匹配 workers4
    expect(p.vp - vp0).toBe(2 * 2 + 4);            // 出售2枚基础分(2人×2) + 商路 vp4
    expect(p.silver).toBe(silver0 + 1);            // 基础1银(第2枚匹配 vp4,非银币格)
    expect(p.tradeRoutePlaced).toBe(2);
  });
});

// ================= 盾徽 =================
describe('盾徽扩展', () => {
  it('建局:按人数分置(2人每区1枚);自动机模式下 2 号被移除', () => {
    const g = createGame({ seed: 31, playerCount: 2, modules: ['shields'] });
    for (const d of g.depots) expect(d.shields!.length).toBe(1);
    const all = g.depots.flatMap((d) => d.shields!);
    expect(all.length).toBe(new Set(all).size);
    const ga = createGame({ seed: 31, playerCount: 2, modules: ['shields', 'automa'] });
    const allA = ga.depots.flatMap((d) => d.shields!);
    expect(allA).not.toContain(2);
  });

  it('对子骰拿盾徽:耗两骰;非对子被拒', () => {
    let g = startPlaying(createGame({ seed: 32, playerCount: 2, modules: ['shields'] }));
    const pi = g.turn.player;
    g.turn.dice = [4, 4];
    g.turn.used = [false, false];
    g.depots[3].shields = [9];
    const m = legalMoves(g).find((x) => x.t === 'takeShield' && x.depot === 4);
    expect(m).toBeDefined();
    g = applyMove(g, m!);
    expect(g.players[pi].shields).toContain(9);
    expect(g.depots[3].shields).toHaveLength(0);
    // 非对子无 takeShield 走子
    const g2 = startPlaying(createGame({ seed: 32, playerCount: 2, modules: ['shields'] }));
    g2.turn.dice = [2, 5];
    g2.turn.used = [false, false];
    expect(legalMoves(g2).some((x) => x.t === 'takeShield')).toBe(false);
  });

  it('纳贡(shieldsTribute 单测):有银付银;盾徽3工人代付;付不起移除', () => {
    const mk = (): { g: GameState } => {
      const g = startPlaying(createGame({ seed: 33, playerCount: 2, modules: ['shields'] }));
      return { g };
    };
    // 付银
    let { g } = mk();
    g.players[0].shields = [5];
    g.players[0].silver = 1;
    shieldsTribute(g, 0);
    expect(g.players[0].shields).toEqual([5]);
    expect(g.players[0].silver).toBe(0);
    // 盾徽3:无银有工 → 工人代付
    ({ g } = mk());
    g.players[0].shields = [3];
    g.players[0].silver = 0;
    g.players[0].workers = 2;
    shieldsTribute(g, 0);
    expect(g.players[0].shields).toEqual([3]);
    expect(g.players[0].workers).toBe(1);
    // 付不起 → 移除
    ({ g } = mk());
    g.players[0].shields = [7, 8];
    g.players[0].silver = 0;
    g.players[0].workers = 0;
    shieldsTribute(g, 0);
    expect(g.players[0].shields).toEqual([]);
  });

  it('盾徽18 改骰(每回合一次)/ 盾徽4 储存扩容 / 盾徽12 出售×2 / 盾徽17 免邻接', () => {
    let g = startPlaying(createGame({ seed: 34, playerCount: 2, modules: ['shields'] }));
    let pi = g.turn.player;
    let p = g.players[pi];
    // 18:改骰
    p.shields = [18];
    g.turn.dice = [3, 5];
    g.turn.used = [false, false];
    g = applyMove(g, { t: 'setDie', die: 0, value: 6 });
    expect(g.turn.dice[0]).toBe(6);
    expect(() => applyMove(g, { t: 'setDie', die: 1, value: 1 })).toThrow(MoveError);
    // 4:储存扩容
    g = startPlaying(createGame({ seed: 34, playerCount: 2, modules: ['shields'] }));
    pi = g.turn.player;
    p = g.players[pi];
    p.shields = [4];
    p.storage = [{ id: 1, color: 'brown', black: false }, { id: 2, color: 'brown', black: false }, { id: 3, color: 'brown', black: false }];
    g.blackDepot[0] = { id: 10, color: 'gray', black: true };
    p.silver = 5;
    g = applyMove(g, { t: 'buyBlack', cell: 0 });
    p = g.players[pi];
    expect(p.storage.length).toBe(4);
    expect(p.storage[3]?.id).toBe(10);
    // 12:出售×2(2人局每枚2分→4分)
    g = startPlaying(createGame({ seed: 34, playerCount: 2, modules: ['shields'] }));
    pi = g.turn.player;
    p = g.players[pi];
    p.shields = [12];
    p.goods[3] = [{ id: 21, color: 3, value: 3 }];
    g.turn.dice = [3, 1];
    g.turn.used = [false, true];
    const vp0 = p.vp;
    g = applyMove(g, { t: 'sell', die: 0 });
    p = g.players[pi];
    expect(p.vp - vp0).toBe(4);
    // 17:免邻接(孤格也在合法走子里)
    g = startPlaying(createGame({ seed: 34, playerCount: 2, modules: ['shields'] }));
    pi = g.turn.player;
    p = g.players[pi];
    p.shields = [17];
    p.storage[0] = { id: 41, color: 'gray', black: false };
    const board = loadBoards().boards.find((b) => b.id === p.boardId)!;
    const dirs = (r: number) => r % 2 === 0
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    const [cr, cc] = p.castleCell!.split(':').map(Number);
    const farCell = board.cells.find((cell) => !p.placed[`${cell.r}:${cell.c}`] && cell.color === 'gray' &&
      !dirs(cell.r).some(([dr, dc]) => cell.r === cr + dr && cell.c === cc + dc));
    if (farCell) {
      g.turn.dice = [farCell.n, 1];
      g.turn.used = [false, true];
      expect(legalMoves(g).some((m) => m.t === 'place' && m.r === farCell.r && m.c === farCell.c)).toBe(true);
    }
  });

  it('终局盾徽计分:1-6=12/7-12=8/13-18=4;13号全×2', () => {
    const g = startPlaying(createGame({ seed: 35, playerCount: 2, modules: ['shields'] }));
    g.players[0].shields = [5, 9, 15];        // 12+8+4 = 24
    endgameScore(g);
    const bd = g.final!.perPlayer.find((x) => x.idx === 0)!.breakdown;
    expect(bd.find((x) => x.label.includes('扩展模块计分'))?.vp).toBe(24);
    const g2 = startPlaying(createGame({ seed: 35, playerCount: 2, modules: ['shields'] }));
    g2.players[0].shields = [13, 5];          // (4+12)*2 = 32
    endgameScore(g2);
    const bd2 = g2.final!.perPlayer.find((x) => x.idx === 0)!.breakdown;
    expect(bd2.find((x) => x.label.includes('扩展模块计分'))?.vp).toBe(32);
  });
});

// ================= 葡萄园 =================
describe('葡萄园扩展(真实玩家侧)', () => {
  it('建局:布袋/补给区(2人3片)/商店(2人1槽)/起始藤奖励板块', () => {
    const g = startPlaying(createGame({ seed: 41, playerCount: 2, modules: ['vineyard'] }));
    expect(g.vineyard).toBeDefined();
    expect(g.vineyard!.supply.length).toBe(3);
    expect(g.vineyard!.shopSlots.length).toBe(1);
    expect(g.vineyard!.supply.every((s) => s.tile)).toBe(true);
    for (const p of g.players) expect(p.vineyard!.bonusTiles.length).toBe(1);
    expect(g.vineyard!.bag.length).toBe(51 - 3 - 1);
  });

  it('拿取双生片:骰点匹配,占 2 储存格;放置+奖励结算+层完成领藤奖励', () => {
    let g = startPlaying(createGame({ seed: 42, playerCount: 2, modules: ['vineyard'] }));
    const pi = g.turn.player;
    let p = g.players[pi];
    // 受控:补给区槽0 放已知双生片(ns=[2],奖励 workers2+vp2)
    // 受控:补给区槽0 放已知双生片(ns=[4],奖励 workers2+vp2);占位版图底层点数为 1/4
    const known: Tile = { id: 6001, color: 'green', black: false, twin: { vines: ['red', 'white'], bonus: ['workers2', 'vp2'] } };
    g.vineyard!.supply[0] = { ns: [4], tile: known };
    p.storage = [null, null, null];
    g.turn.dice = [4, 4];
    g.turn.used = [false, false];
    g = applyMove(g, { t: 'takeTwin', die: 0, slot: 0 });
    p = g.players[pi];
    expect(p.storage.filter((s) => s?.id === 6001).length).toBe(2);
    // 该层其余空间预置已放 → 放置后层完成
    const space = vineyardSpaces().find((s) => s.layer === 0 && s.n === 4)!;
    for (const s of vineyardSpaces().filter((x) => x.layer === 0 && x.id !== space.id)) {
      p.vineyard!.placed[s.id] = { tile: twin(7000, ['blue', 'blue'], ['vp2', 'vp2']), rot: 0 };
    }
    const workers0 = p.workers;
    const vp0 = p.vp;
    const bonuses0 = p.vineyard!.bonusTiles.length;
    const pile0 = g.vineyard!.bonusPile.length;
    // 清空补给区(让 takeShipLivestock 落空,避免额外待决)
    for (const d of g.depots) d.cells = d.cells.map(() => null);
    // 官方模型(2026-09-23 勘定):奖励印在版图格 —— 底层 n=4 位 = takeShipLivestock + workers4,
    // 片上 bonus( workers2/vp2 )不再生效
    g = applyMove(g, { t: 'placeTwin', die: 1, storage: 0, space: space.id, rot: 0 });
    p = g.players[pi];
    expect(p.workers).toBe(workers0 + 4);            // 版图格 workers4(非片上 workers2)
    expect(p.vp - vp0).toBe(0);                      // 片上 vp2 不生效
    expect(p.vineyard!.placed[space.id].tile.id).toBe(6001);
    // 层完成 → vineBonus 待决
    expect(g.pending[g.pending.length - 1].kind).toBe('vineBonus');
    const wantType = g.vineyard!.bonusPile[0];
    g = applyMove(g, { t: 'takeVineBonus', type: wantType });
    p = g.players[pi];
    expect(p.vineyard!.bonusTiles.length).toBe(bonuses0 + 1);
    expect(g.vineyard!.bonusPile.length).toBe(pile0 - 1);
  });

  it('首个双生片必须放底层', () => {
    let g = startPlaying(createGame({ seed: 44, playerCount: 2, modules: ['vineyard'] }));
    const pi = g.turn.player;
    const p = g.players[pi];
    p.storage[0] = twin(8001, ['red', 'red'], ['vp2', 'vp2']);
    p.storage[1] = p.storage[0];
    const upper = vineyardSpaces().find((s) => s.layer === 1)!;
    g.turn.dice = [upper.n, 1];
    g.turn.used = [false, true];
    expect(() => applyMove(g, { t: 'placeTwin', die: 0, storage: 0, space: upper.id, rot: 0 })).toThrow(MoveError);
  });

  it('商店购买双生片(与黑区共用每回合一次)', () => {
    let g = startPlaying(createGame({ seed: 43, playerCount: 2, modules: ['vineyard'] }));
    const pi = g.turn.player;
    let p = g.players[pi];
    g.vineyard!.shopSlots[0] = twin(6100, ['red', 'red'], ['vp2', 'vp2']);
    g.blackDepot[0] = null;
    p.silver = 5;
    p.storage = [null, null, null];
    g = applyMove(g, { t: 'buyBlack', cell: 0, shop: true });
    p = g.players[pi];
    expect(p.silver).toBe(3);
    expect(p.storage.filter((s) => s?.id === 6100).length).toBe(2);
    expect(() => applyMove(g, { t: 'buyBlack', cell: 0 })).toThrow(MoveError);
  });

  it('终局葡萄藤计分:区域按类型计分入明细(vineyardEndgameVP 经 onEndgame)', () => {
    const g = startPlaying(createGame({ seed: 45, playerCount: 2, modules: ['vineyard'] }));
    const p = g.players[0];
    // 构造:L0 三片(红红 / 白蓝 / 红绿);奖励板块 red + green
    p.vineyard!.placed = {
      L0S0: { tile: twin(1, ['red', 'red'], ['vp2', 'vp2']), rot: 0 },
      L0S1: { tile: twin(2, ['white', 'blue'], ['vp2', 'vp2']), rot: 0 },
      L0S2: { tile: twin(3, ['red', 'green'], ['vp2', 'vp2']), rot: 0 },
    };
    p.vineyard!.bonusTiles = [{ type: 'red' }, { type: 'green' }];
    const regions = vineyardRegions(g, 0);
    expect(regions['red'].length).toBeGreaterThanOrEqual(1);
    endgameScore(g);
    const bd = g.final!.perPlayer.find((x) => x.idx === 0)!.breakdown;
    const vine = bd.find((x) => x.label.includes('扩展模块计分'));
    expect(vine).toBeDefined();
    expect(vine!.vp).toBeGreaterThan(0);
  });
});

// ================= 边境哨所 =================
describe('边境哨所(第四扩展,引擎)', () => {
  const board: DuchyBoard = {
    id: 9001,
    cells: [
      { r: 0, c: 0, color: 'gray', n: 1, outpost: 1 },
      { r: 0, c: 1, color: 'gray', n: 2 },
      { r: 0, c: 2, color: 'gray', n: 3 },
      { r: 0, c: 3, color: 'gray', n: 4, outpost: 2 },
      { r: 1, c: 1, color: 'gray', n: 5 },
      { r: 1, c: 2, color: 'gray', n: 6 },
      { r: 2, c: 1, color: 'gray', n: 1, outpost: 3 },
    ],
  };
  it('连通分量:中间板块导通;分隔时孤立', () => {
    const placed = new Set(['0:0', '0:3']);
    let comp = outpostComponents(board, placed);
    expect(comp.size).toBe(2);
    expect(comp.get(1)).not.toBe(comp.get(2));
    placed.add('0:1');
    placed.add('0:2');                               // 0:1 与 0:3 之间需 0:2 导通
    comp = outpostComponents(board, placed);
    expect(comp.get(1)).toBe(comp.get(2));
    expect(comp.get(3)).toBeUndefined();
    for (const k of ['0:2', '1:1', '1:2', '2:1']) placed.add(k);
    comp = outpostComponents(board, placed);
    expect(comp.get(1)).toBe(comp.get(3));
    expect(new Set([...comp.values()]).size).toBe(1);
  });

  it('得分:2连通按阶段计分一次;3连通首位/次位奖励板块', () => {
    const g = startPlaying(createGame({ seed: 51, playerCount: 2, modules: ['exp4'] }));
    const p = g.players[0];
    const vp0 = p.vp;
    // 2连通(阶段A=10;0:2 为 0:1→0:3 的桥)
    p.placed['0:0'] = { id: 1, color: 'gray', black: false };
    p.placed['0:1'] = { id: 2, color: 'gray', black: false };
    p.placed['0:2'] = { id: 4, color: 'gray', black: false };
    p.placed['0:3'] = { id: 3, color: 'gray', black: false };
    expect(outpostsCheck(g, 0, board)).toBe(10);
    expect(p.vp - vp0).toBe(10);
    // 重复触发:2连不再计分
    expect(outpostsCheck(g, 0, board)).toBe(0);
    expect(p.vp - vp0).toBe(10);
    // 3连通首位(2人=5)
    for (const [k, id] of [['1:1', 5], ['1:2', 6], ['2:1', 7]] as const) {
      p.placed[k] = { id, color: 'gray', black: false };
    }
    expect(outpostsCheck(g, 0, board)).toBe(0);        // 返回值只含 2连分(已结);3连分已直接入账
    expect(p.vp - vp0).toBe(15);
    // 第二位玩家(2人=2)
    const q = g.players[1];
    const qvp0 = q.vp;
    for (const [k, id] of [['0:0', 11], ['0:1', 12], ['0:2', 13], ['0:3', 14], ['1:1', 15], ['1:2', 16], ['2:1', 17]] as const) {
      q.placed[k] = { id, color: 'gray', black: false };
    }
    outpostsCheck(g, 1, board);
    // 一次放满:2连分(10,首次)+ 3连次位奖励(2人=2)
    expect(q.vp - qvp0).toBe(12);
    // 第三位无奖
    expect(g.outpostClaims!.done3.length).toBe(2);
  });
});

// ================= 集成 =================
describe('P2 整局集成与重放', () => {
  it('各模块组合整局跑通且重放一致', () => {
    const combos: string[][] = [
      ['exp6'],
      ['exp8'],
      ['shields'],
      ['vineyard'],
      ['exp6', 'exp8', 'shields', 'vineyard'],
      ['shields', 'automa'],
      ['exp8', 'automa'],
    ];
    for (const modules of combos) {
      const seed = 1000 + modules.length * 7 + modules[0].length;
      const playerCount = modules.includes('automa') ? 2 : 3;
      const a = playFull(seed, playerCount, modules, 0);
      const b = playFull(seed, playerCount, modules, 0);
      expect(a.final.status, modules.join('+')).toBe('ended');
      expect(hashState(a.final), modules.join('+')).toBe(hashState(b.final));
      expect(a.journal.length, modules.join('+')).toBe(b.journal.length);
      let g = createGame({ seed, playerCount, modules: modules as GameState['modules'] });
      for (const m of a.journal) g = applyMove(g, m);
      expect(hashState(g), modules.join('+')).toBe(hashState(a.final));
    }
  }, 20000);
});
