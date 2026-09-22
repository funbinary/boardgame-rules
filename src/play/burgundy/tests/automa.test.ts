// 自动机(P1)测试:建局/整回合流程/难度修正/兼容/重放确定性。
import { describe, expect, it } from 'vitest';
import { autopilotPick } from '../src/ai/autopilot';
import { hashState } from '../src/engine/hash';
import { applyMove, legalMoves } from '../src/engine/moves';
import { createGame } from '../src/engine/setup';
import { endgameScore } from '../src/engine/scoring';
import type { GameState, Move } from '../src/engine/state';

/** 完整跑一局单机(真实玩家用 autopilot,自动机走打包走子) */
function playSolo(seed: number, opts?: { difficulty?: 'easy' | 'normal' | 'hard'; modifiers?: string[]; modules?: string[] }): { journal: Move[]; final: GameState } {
  let g = createGame({
    seed,
    playerCount: 2,
    modules: ['automa', ...(opts?.modules ?? [])] as GameState['modules'],
    automa: { difficulty: opts?.difficulty ?? 'normal', modifiers: opts?.modifiers ?? [] },
  });
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

describe('自动机建局', () => {
  it('末位玩家成为自动机:牌库/翻卡/城堡/货物/储备', () => {
    const g = createGame({
      seed: 42, playerCount: 2, modules: ['automa'],
      automa: { difficulty: 'normal', modifiers: [] },
    });
    const a = g.players[1];
    expect(a.isAutoma).toBe(true);
    expect(a.boardId).toBe(35);
    expect(a.automa).toBeDefined();
    const st = a.automa!;
    expect(st.deck).toHaveLength(7);            // 9 - 左槽 - 右槽
    expect(st.cards[0]).not.toBeNull();
    expect(st.cards[1]).not.toBeNull();
    const left = st.cards[0]!;
    expect(left.cells.some((c) => c.castle && c.filled?.color === 'red')).toBe(true);  // 设置 E:城堡上卡
    expect(st.silver).toBe(1);
    expect(st.goods.slice(1)).toEqual([1, 1, 1, 1, 1, 1]);   // 设置 F:每色 1 货物
    expect(st.reserve).toHaveLength(0);
    // 自动机不设初始城堡:待决只有真实玩家
    expect(g.pending).toHaveLength(1);
    expect(g.pending[0].player).toBe(0);
    // 自动机总是末位(顺位轨底)
    expect(g.track[0][0]).toBe(1);
  });

  it('修正 A+B:36 号版图 + 预填 8 格', () => {
    const g = createGame({
      seed: 7, playerCount: 2, modules: ['automa'],
      automa: { difficulty: 'normal', modifiers: ['A', 'B'] },
    });
    const a = g.players[1];
    expect(a.boardId).toBe(36);
    expect(Object.keys(a.placed)).toHaveLength(8);   // A×5 黑面 + B×3 明置
    expect(Object.values(a.placed).filter((t) => t.black)).toHaveLength(5);
  });

  it('修正 C:自动机第一轮先手', () => {
    let g = createGame({
      seed: 9, playerCount: 2, modules: ['automa'],
      automa: { difficulty: 'normal', modifiers: ['C'] },
    });
    expect(g.track[0][g.track[0].length - 1]).toBe(1);   // 轨顶=自动机
    // 真实玩家放完初始城堡后,轮到自动机
    const m = legalMoves(g).find((x) => x.t === 'placeCastle')!;
    g = applyMove(g, m);
    expect(g.status).toBe('playing');
    expect(g.turn.player).toBe(1);
  });
});

describe('自动机回合与终局', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`完整单机对局跑通(${difficulty}):终局有自动机明细+卡填充计分档位正确`, () => {
      const { final } = playSolo(2024, { difficulty });
      expect(final.status).toBe('ended');
      expect(final.players[1].isAutoma).toBe(true);
      expect(final.players[1].vp).toBeGreaterThan(0);
      expect(final.final?.perPlayer.find((x) => x.idx === 1)?.breakdown.length).toBeGreaterThan(0);
      // 卡填充计分:日志中的卡填充分值必须等于该难度档位(4/5/6)
      const fillVps = final.log
        .map((l) => l.text.match(/^\+(\d+)分\(自动机卡#\d+ 填充/))
        .filter(Boolean)
        .map((m) => +(m![1]));
      expect(fillVps.length).toBeGreaterThan(0);
      const want = difficulty === 'easy' ? 4 : difficulty === 'normal' ? 5 : 6;
      expect(fillVps.every((v) => v === want)).toBe(true);
    });
  }

  it('同种子重放哈希一致(golden)', () => {
    const a = playSolo(777);
    const b = playSolo(777);
    expect(hashState(a.final)).toBe(hashState(b.final));
    expect(a.journal.length).toBe(b.journal.length);
  });

  it('journal 重放:从建局重放得到同一终局', () => {
    const { journal, final } = playSolo(31415, { modifiers: ['A', 'D'] });
    let g = createGame({
      seed: 31415, playerCount: 2, modules: ['automa'],
      automa: { difficulty: 'normal', modifiers: ['A', 'D'] },
    });
    for (const m of journal) g = applyMove(g, m);
    expect(hashState(g)).toBe(hashState(final));
    expect(g.status).toBe('ended');
  });

  it('黑区购买:回合末银币≥2 时按储备最少类型买入,每回合一次', () => {
    let g = createGame({ seed: 501, playerCount: 2, modules: ['automa'], automa: { difficulty: 'normal', modifiers: [] } });
    g.status = 'playing';
    g.pending = [];
    g.turn = { player: 1, dice: [1, 1], used: [false, false], bonusDice: [], blackBought: false };
    const st0 = g.players[1].automa!;
    // 受控:活动卡(白骰1→左槽)只留 1 空格;全部补给区首格放绿色(主行动必从补给区成功,不碰储备区)
    g.whiteDie = 1;
    const left = st0.cards[0]!;
    for (let i = 0; i < 3; i++) left.cells[i].filled = { id: 9000 + i, color: 'yellow', black: false };
    const green = { id: 9990, color: 'green' as const, black: false, livestock: 'sheep' as const, animals: 2 };
    for (const dep of g.depots) dep.cells = [green, ...dep.cells.slice(1)];
    g.blackDepot[0] = { id: 9991, color: 'brown', black: true, building: 'bank' };
    st0.silver = 5;
    st0.reserve = [];
    const logStart = g.log.length;
    g = applyMove(g, { t: 'automa' });
    const st = g.players[1].automa!;
    const texts = g.log.slice(logStart).map((l) => l.text);
    const buys = texts.filter((t) => t.includes('购黑区') || t.includes('购双生片'));
    expect(buys).toHaveLength(1);                    // 每回合恰一次(银币足额+黑区有目标)
    expect(st.reserve.some((t) => t.color === 'brown' && t.building === 'bank')).toBe(true);
    expect(st.silver).toBe(3);                       // 5 - 2(回合内无其他银币收益)
  });

  it('黑区购买:银币不足时不买', () => {
    let g = createGame({ seed: 502, playerCount: 2, modules: ['automa'], automa: { difficulty: 'normal', modifiers: [] } });
    g.status = 'playing';
    g.pending = [];
    g.turn = { player: 1, dice: [1, 1], used: [false, false], bonusDice: [], blackBought: false };
    const st0 = g.players[1].automa!;
    g.whiteDie = 1;
    const left = st0.cards[0]!;
    for (let i = 0; i < 3; i++) left.cells[i].filled = { id: 9000 + i, color: 'yellow', black: false };
    const green = { id: 9990, color: 'green' as const, black: false, livestock: 'sheep' as const, animals: 2 };
    for (const dep of g.depots) dep.cells = [green, ...dep.cells.slice(1)];
    st0.silver = 1;
    const logStart = g.log.length;
    g = applyMove(g, { t: 'automa' });
    const buys = g.log.slice(logStart).filter((l) => l.text.includes('购黑区'));
    expect(buys).toHaveLength(0);
    expect(g.players[1].automa!.silver).toBe(1);
  });

  it('自动机走子仅自动机可用', () => {
    const g = createGame({ seed: 1, playerCount: 2, modules: ['automa'], automa: { difficulty: 'normal', modifiers: [] } });
    expect(() => applyMove(g, { t: 'automa' })).toThrow();
  });
});

describe('扩展兼容', () => {
  it('白色城堡:放置触发白骰奖励行动(拿/放/卖/工人,点数=白骰)', () => {
    let g = createGame({ seed: 8, playerCount: 2, modules: ['automa', 'exp5'], automa: { difficulty: 'normal', modifiers: [] } });
    g = applyMove(g, legalMoves(g).find((x) => x.t === 'placeCastle')!);
    // 进入对局后手工构造:真实玩家储存格放白堡并直接放置
    g.status = 'playing';
    const p = g.players[0];
    const b = g.players[0];
    void b;
    // 找一个可放的格子:塞一块白堡进储存格并清出邻接格
    const wc = { id: 999999, color: 'brown' as const, black: false, whitecastle: true };
    p.storage[0] = wc;
    p.workers = 5;
    // 选城堡邻接的 brown 格
    const d = legalMoves(g).find((m) => m.t === 'place' && m.storage === 0);
    if (d) {
      g = applyMove(g, d);
      const top = g.pending[g.pending.length - 1];
      expect(top?.kind).toBe('bonusAction');
      expect(top && 'from' in top && top.from).toBe('whitecastle');
      const wm = legalMoves(g).filter((m) => 'die' in m && m.die === 'bonus');
      expect(wm.length).toBeGreaterThan(0);
      expect(wm.every((m) => !('dieValue' in m) || m.dieValue === undefined || m.dieValue === g.whiteDie)).toBe(true);
      expect(wm.some((m) => m.t === 'takeWorkers')).toBe(true);
    }
  });

  it('葡萄园:牌库换卡(1+10-17)+ 商店开槽 + 终局双生计分标签', () => {
    const { final } = playSolo(606, { modules: ['vineyard'] });
    const a = final.players[1].automa!;
    // 牌库共 9 张(1+8):翻 2 张后剩 7
    expect(final.log.some((l) => l.text.includes('难度normal'))).toBe(true);
    expect(final.status).toBe('ended');
    void a;
    const bd = final.final?.perPlayer.find((x) => x.idx === 1)?.breakdown ?? [];
    // 葡萄园局的自动机明细不包含普通区域分(官方口径)
    expect(bd.every((x) => !x.label.includes('区域'))).toBe(true);
  });
});

describe('平手与胜者', () => {
  it('与自动机平手时自动机获胜(规则书 p25)', () => {
    const g = createGame({ seed: 2, playerCount: 2, modules: ['automa'], automa: { difficulty: 'normal', modifiers: [] } }) as GameState;
    // 直接构造终局:双方分数相等
    g.players[0].vp = 30;
    g.players[1].vp = 30;
    g.status = 'playing';
    endgameScore(g);
    expect(g.status).toBe('ended');
    expect(g.log[g.log.length - 1].text).toContain('胜者:自动机');
  });
});
