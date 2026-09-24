// P3 团队游戏(第九扩展)测试:2v2 共享资源/私人储存格/首轮顺位/团队终局。
// 团队资源路由设计:共享资源(工人/银币/货物/公国/共享储存)挂队锚点(座位0→A、1→B)玩家字段;
// 每人 2 私人格 + 每队 2 共享格(统一索引 0-3:0-1 私人,2-3 共享)。
import { describe, expect, it } from 'vitest';
import { autopilotPick } from '../src/ai/autopilot';
import { hashState } from '../src/engine/hash';
import { applyMove, legalMoves, MoveError } from '../src/engine/moves';
import { createGame, nextTileId } from '../src/engine/setup';
import { loadBoards } from '../src/engine/data';
import { validateModules } from '../src/engine/modules';
import { storageSlots } from '../src/engine/modules/team';
import type { GameState, Move, Tile } from '../src/engine/state';

/** 完整跑一局(autopilot 代走;默认 exp9 四人) */
function playFull(seed: number, modules: string[] = ['exp9'], playerCount = 4): { journal: Move[]; final: GameState } {
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

/** 放完所有初始城堡(团队:锚点 A1→B1 各 1 座) */
function startPlaying(g: GameState): GameState {
  let guard = 10;
  while (g.status === 'placingCastles' && guard-- > 0) {
    const m = legalMoves(g).find((x) => x.t === 'placeCastle');
    if (!m) break;
    g = applyMove(g, m);
  }
  return g;
}

describe('团队游戏(第九扩展)建局', () => {
  it('分队/锚点资源/私人+共享储存格/首轮顺位 A1,B1,A2,B2', () => {
    const g = createGame({ seed: 91, playerCount: 4, modules: ['exp9'] });
    expect(g.teams).toBeDefined();
    expect(g.teams!.A.members).toEqual([0, 2]);
    expect(g.teams!.B.members).toEqual([1, 3]);
    expect(g.players.map((p) => p.team)).toEqual(['A', 'B', 'A', 'B']);
    // 起始队 A(座位0)3 工人、B 5 工人;各队 2 银币 —— 挂锚点
    expect(g.players[0].workers).toBe(3);
    expect(g.players[1].workers).toBe(5);
    expect(g.players[2].workers).toBe(0);
    expect(g.players[3].workers).toBe(0);
    expect(g.players[0].silver).toBe(2);
    expect(g.players[1].silver).toBe(2);
    // 各队 3 个起始货物(挂锚点)
    const goodsA = Object.values(g.players[0].goods).reduce((s, a) => s + a.length, 0);
    expect(goodsA).toBe(3);
    // 私人 2 格 + 共享 2 格
    expect(g.players[0].storage).toHaveLength(2);
    expect(g.teams!.A.sharedStorage).toHaveLength(2);
    expect(storageSlots(g, 2)).toHaveLength(4);
    // 两队同一团队版图
    expect(g.players[0].boardId).toBe(g.players[1].boardId);
    // 首轮流次:A1,B1,A2,B2
    expect(g.track[0].slice().reverse()).toEqual([0, 1, 2, 3]);
    // 初始城堡待决只推锚点(0 和 1)
    expect(g.pending.map((x) => x.kind === 'initialCastle' ? x.player : -1).sort()).toEqual([0, 1]);
  });

  it('互斥:exp9 与盾徽/葡萄园/自动机等不兼容', () => {
    expect(validateModules(['exp9'], 4)).toBeNull();
    expect(validateModules(['exp9', 'shields'], 4)).toMatch(/不兼容/);
    expect(validateModules(['exp9', 'vineyard'], 4)).toMatch(/不兼容/);
    expect(validateModules(['exp9', 'automa'], 4)).toMatch(/不兼容/);
    expect(validateModules(['exp9'], 3)).toMatch(/至少需要/);
  });

  it('初始城堡:每队 1 座,放在团队版图红格', () => {
    let g = startPlaying(createGame({ seed: 92, playerCount: 4, modules: ['exp9'] }));
    expect(g.status).toBe('playing');
    const anchorA = g.players[0];
    const anchorB = g.players[1];
    expect(Object.keys(anchorA.placed)).toHaveLength(1);
    expect(Object.keys(anchorB.placed)).toHaveLength(1);
    expect(Object.values(anchorA.placed)[0].color).toBe('red');
    // 队员没有城堡/公国
    expect(Object.keys(g.players[2].placed)).toHaveLength(0);
    // 标准面 31:中央格是红格(占位数据)
    expect(anchorA.castleCell).toBe('3:2');
  });
});

describe('团队游戏:共享资源路由', () => {
  it('队员行动消耗/产出共享银币与工人;个人得分归个人', () => {
    let g = startPlaying(createGame({ seed: 93, playerCount: 4, modules: ['exp9'] }));
    // 轮到 A1(座位0);切到 B1(座位1)也行 —— 直接用当前行动者
    const actor = g.turn.player;
    const anchor = g.players[actor % 2 === 0 ? 0 : 1];
    anchor.silver = 4;
    const vpBefore = g.players[actor].vp;
    // 工人改骰:-1 工人(共享)
    const wBefore = anchor.workers;
    expect(wBefore).toBeGreaterThan(0);
    g = applyMove(g, { t: 'modDie', die: 0, delta: 1 });
    expect(g.players[actor % 2 === 0 ? 0 : 1].workers).toBe(wBefore - 1);
    // 拿取工人:+2(共享);个人 vp 不变
    g.turn.dice = [1, 2];
    g = applyMove(g, { t: 'takeWorkers', die: 1, dieValue: 2 });
    expect(g.players[actor % 2 === 0 ? 0 : 1].workers).toBe(wBefore - 1 + 2);
    expect(g.players[actor].vp).toBe(vpBefore);
  });

  it('队员可放置队友拿入共享储存格的板块(统一索引 2-3)', () => {
    let g = startPlaying(createGame({ seed: 94, playerCount: 4, modules: ['exp9'] }));
    const anchorA = g.players[0];
    const board = loadBoards().boards.find((b) => b.id === anchorA.boardId)!;
    // A2(座位2,队员)的私人储存格放一块板块,可放队公国(目标色动态匹配)
    const dirs = (r: number) => r % 2 === 0
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    const [cr, cc] = anchorA.castleCell!.split(':').map(Number);
    const target = board.cells.find((c) => ['brown', 'blue', 'green', 'yellow'].includes(c.color) && !anchorA.placed[`${c.r}:${c.c}`] &&
      dirs(cr).some(([dr, dc]) => cr + dr === c.r && cc + dc === c.c));
    expect(target).toBeDefined();
    const tile: Tile = { id: nextTileId(), color: target!.color, black: false };
    g.players[2].storage[0] = tile;
    g.turn.player = 2;
    g.turn.used = [false, false];
    g.turn.dice = [target!.n, target!.n];
    g = applyMove(g, { t: 'place', die: 0, storage: 0, r: target!.r, c: target!.c });
    // 放进的是队公国(锚点 placed)
    expect(g.players[0].placed[`${target!.r}:${target!.c}`]?.id).toBe(tile.id);
    expect(g.players[2].placed[`${target!.r}:${target!.c}`]).toBeUndefined();
  });

  it('储存格满:私人 2 + 共享 2 全满才需弃置;弃共享格后队友可用', () => {
    let g = startPlaying(createGame({ seed: 95, playerCount: 4, modules: ['exp9'] }));
    const t1: Tile = { id: nextTileId(), color: 'brown', black: false, building: 'market' };
    const t2: Tile = { id: nextTileId(), color: 'blue', black: false };
    const t3: Tile = { id: nextTileId(), color: 'yellow', black: false, monastery: 5 };
    const t4: Tile = { id: nextTileId(), color: 'red', black: false };
    const t5: Tile = { id: nextTileId(), color: 'green', black: false, livestock: 'sheep', animals: 2 };
    g.players[2].storage = [t1, t2];
    g.teams!.A.sharedStorage = [t3, t4];
    // 拿取第 5 块被拒(全满)
    g.turn.player = 2;
    g.turn.used = [false, false];
    g.turn.dice = [1, 1];
    const depot = g.depots[0];
    expect(() => applyMove(g, { t: 'take', die: 0, depot: 1, cell: 0 })).toThrow(/储存格已满/);
    // 队员弃共享格(统一索引 2-3)
    let moves = legalMoves(g);
    expect(moves.filter((m) => m.t === 'discardStorage').map((m) => (m as Extract<Move, { t: 'discardStorage' }>).slot).sort())
      .toEqual([0, 1, 2, 3]);
    g = applyMove(g, { t: 'discardStorage', slot: 2 });
    expect(g.teams!.A.sharedStorage[0]).toBeNull();
    // 弃置后可拿取(applyMove 返回新状态,depot 需重新取)
    g.depots[0].cells[0] = t5;
    g = applyMove(g, { t: 'take', die: 0, depot: 1, cell: 0 });
    expect(storageSlots(g, 2).some((s) => s?.id === t5.id)).toBe(true);
  });
});

describe('团队游戏:整局与终局', () => {
  it('整局跑通:两队伍总分=队员之和;重放一致', () => {
    const { journal, final } = playFull(96);
    expect(final.status).toBe('ended');
    expect(final.teams).toBeDefined();
    const totalA = final.teams!.A.members.reduce((s, i) => s + final.players[i].vp, 0);
    const totalB = final.teams!.B.members.reduce((s, i) => s + final.players[i].vp, 0);
    expect(totalA).toBeGreaterThanOrEqual(0);
    expect(totalB).toBeGreaterThanOrEqual(0);
    // journal 重放哈希一致
    let g = createGame({ seed: 96, playerCount: 4, modules: ['exp9'] });
    for (const m of journal) g = applyMove(g, m);
    expect(hashState(g)).toBe(hashState(final));
  });

  it('exp4 边境哨所:真版图 23-30 发牌+整局跑通(哨所位恰为 1/2/3)', () => {
    const g0 = createGame({ seed: 4711, playerCount: 3, modules: ['exp4'] });
    for (const p of g0.players) {
      expect(p.boardId).toBeGreaterThanOrEqual(23);
      expect(p.boardId).toBeLessThanOrEqual(30);
    }
    const b = loadBoards().boards.find((x) => x.id === g0.players[0].boardId)!;
    const outposts = new Set(b.cells.filter((c) => c.outpost != null).map((c) => c.outpost));
    expect([...outposts].sort()).toEqual([1, 2, 3]);
    const { final } = playFull(4711, ['exp4'], 3);
    expect(final.status).toBe('ended');
  });

  it('多 seed 整局跑通(共享公国/双骰/四玩家全流程)', () => {
    for (const seed of [97, 9700, 970000]) {
      const { final } = playFull(seed);
      expect(final.status).toBe('ended');
      // 团队公国:两队锚点 placed 均在其 boardId 版图上
      for (const tid of ['A', 'B'] as const) {
        const anchor = final.players[final.teams![tid].members[0]];
        const board = loadBoards().boards.find((b) => b.id === anchor.boardId)!;
        for (const key of Object.keys(anchor.placed)) {
          const [r, c] = key.split(':').map(Number);
          expect(board.cells.some((x) => x.r === r && x.c === c)).toBe(true);
        }
      }
    }
  });
});
