// 引擎冒烟+确定性+全流程测试(M1)
import { describe, expect, it } from 'vitest';
import { hashState } from '../src/engine/hash';
import { applyMove, legalMoves } from '../src/engine/moves';
import { createGame } from '../src/engine/setup';
import type { GameState, Move } from '../src/engine/state';

/** 按固定规则选一步(确定性"猴子"策略):优先卖货>放置>拿取>工人 */
function pickMove(g: GameState, salt = 0): Move {
  const ms = legalMoves(g);
  if (!ms.length) throw new Error(`无合法走子:status=${g.status} pending=${JSON.stringify(g.pending.at(-1))} turn=${JSON.stringify(g.turn)}`);
  const pri = (m: Move): number => {
    if (m.t === 'placeCastle') return 0;
    if (m.t.startsWith('answer')) return 1;
    if (m.t === 'place') return 2;
    if (m.t === 'sell') return 3;
    if (m.t === 'take') return 4;
    if (m.t === 'mon6Buy' || m.t === 'answerTake') return 5;
    if (m.t === 'takeWorkers') return 8;
    if (m.t === 'buyBlack') return 9;
    if (m.t === 'modDie' || m.t === 'discardStorage') return 20;
    return 10;
  };
  ms.sort((a, b) => pri(a) - pri(b));
  const idx = salt % Math.min(ms.length, 3);
  return ms[idx];
}

function runGame(seed: number, playerCount: number, salt = 0): GameState {
  let g = createGame({ seed, playerCount });
  let guard = 20000;
  while (g.status !== 'ended' && guard-- > 0) {
    g = applyMove(g, pickMove(g, salt));
  }
  if (guard <= 0) throw new Error('对局未在步数上限内结束');
  return g;
}

describe('引擎核心', () => {
  it('建局确定性:同种子同哈希', () => {
    const a = createGame({ seed: 42, playerCount: 2 });
    const b = createGame({ seed: 42, playerCount: 2 });
    expect(hashState(a)).toBe(hashState(b));
  });

  it('建局基础校验:工人分配/起始银币/货物3枚/阶段A补给', () => {
    const g = createGame({ seed: 7, playerCount: 3 });
    expect(g.players.every((p) => p.silver === 1)).toBe(true);
    expect(g.players.every((p) => Object.values(p.goods).reduce((s, x) => s + x.length, 0) === 3)).toBe(true);
    const workers = g.players.map((p) => p.workers).sort((x, y) => x - y);
    expect(workers).toEqual([1, 2, 3]);
    expect(g.depots.length).toBe(6);
    expect(g.roundGoods.length).toBe(4);   // 5 枚中 1 枚已随白骰上补给区
    expect(g.status).toBe('placingCastles');
    expect(g.pending.length).toBe(3);
  });

  it('完整对局跑通:2人(兜底数据)', () => {
    const g = runGame(123, 2);
    expect(g.status).toBe('ended');
    expect(g.phase).toBe(4);
    expect(g.round).toBe(5);
    expect(g.players.every((p) => p.vp > 0)).toBe(true);
    expect(g.final).toBeDefined();
  });

  it('完整对局跑通:4人', () => {
    const g = runGame(999, 4, 1);
    expect(g.status).toBe('ended');
    expect(g.players).toHaveLength(4);
  });

  it('重放一致性:同种子同策略哈希一致', () => {
    const a = runGame(2024, 2, 0);
    const b = runGame(2024, 2, 0);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('非法走子被拒绝', () => {
    const g = createGame({ seed: 1, playerCount: 2 });
    expect(() => applyMove(g, { t: 'takeWorkers', die: 0 })).toThrow();
  });
});
