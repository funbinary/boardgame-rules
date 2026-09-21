// golden 回放测试:整局走子记录成 journal,从建局重放必须得到同一终局哈希。
// 这是联机"意图走子+日志重放"正确性的基石。
import { describe, expect, it } from 'vitest';
import { autopilotPick } from '../src/ai/autopilot';
import { hashState } from '../src/engine/hash';
import { applyMove } from '../src/engine/moves';
import { createGame } from '../src/engine/setup';
import type { GameState, Move } from '../src/engine/state';

function playFullGame(seed: number, playerCount: number): { journal: Move[]; final: GameState } {
  let g = createGame({ seed, playerCount });
  const journal: Move[] = [];
  let guard = 30000;
  while (g.status !== 'ended' && guard-- > 0) {
    const m = autopilotPick(g);
    if (!m) throw new Error(`死局:${JSON.stringify({ s: g.status, p: g.pending.at(-1), t: g.turn })}`);
    journal.push(m);
    g = applyMove(g, m);
  }
  if (guard <= 0) throw new Error('未在步数上限内结束');
  return { journal, final: g };
}

describe('golden 回放', () => {
  for (const [seed, pc] of [[3, 2], [555, 3], [8888, 4]] as const) {
    it(`重放一致:seed=${seed} ${pc}人`, () => {
      const { journal, final } = playFullGame(seed, pc);
      let g = createGame({ seed, playerCount: pc });
      for (const m of journal) g = applyMove(g, m);
      expect(hashState(g)).toBe(hashState(final));
      expect(g.status).toBe('ended');
      expect(journal.length).toBeGreaterThan(pc * 25 * 2);  // 至少每人每轮 2 行动
    });
  }

  it('journal 单步篡改被哈希察觉', () => {
    const { journal, final } = playFullGame(77, 2);
    let g = createGame({ seed: 77, playerCount: 2 });
    for (const m of journal) g = applyMove(g, m);
    expect(hashState(g)).toBe(hashState(final));
    // 换一步重放:必然不一致(极小概率相同——哈希 64bit)
    let h = createGame({ seed: 77, playerCount: 2 });
    const swapped = journal.slice();
    const i = swapped.findIndex((m) => m.t === 'takeWorkers');
    swapped.splice(i, 1);
    for (const m of swapped) { try { h = applyMove(h, m); } catch { break; } }
    expect(hashState(h)).not.toBe(hashState(final));
  });
});
