// net 层单测:journal 重放 / 乱序重同步 / 超时代走消息(不真连 WS,handle() 直驱)。
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayClient, wsFactory } from '../src/net/client';
import type { ClientMsg, JournalEntry, ServerMsg, ServerPlayer, ServerRoom } from '../src/net/protocol';
import protocolFixture from '../../../../server/internal/play/protocol.fixture.json';
import { createGame } from '../src/engine/setup';
import { dataVersion } from '../src/engine/dataVersion';
import { autopilotPick } from '../src/ai/autopilot';
import { applyMove } from '../src/engine/moves';
import type { GameState, Move } from '../src/engine/state';

function makeClient(journalSink?: (m: unknown) => void) {
  const states: (GameState | null)[] = [];
  const msgs: ServerMsg[] = [];
  const sent: unknown[] = [];
  const mismatches: [string, string][] = [];
  const c = new PlayClient(
    'test01',
    (seed, _mods, seats) => createGame({ seed, playerCount: seats }),
    {
      onStatus: () => {},
      onMsg: (m) => msgs.push(m),
      onState: (g) => states.push(g),
      onDesync: () => {},
      onVersionMismatch: (rv, lv) => mismatches.push([rv, lv]),
    },
  );
  // 拦截 send
  (c as unknown as { send: (o: unknown) => void }).send = (o: unknown) => {
    sent.push(o);
    journalSink?.(o);
  };
  return { c, states, msgs, sent, mismatches };
}

function roomJson(seed: number, status = 'playing', dv = '') {
  return {
    ID: 'test01', GameKey: 'burgundy', Modules: '[]', Seats: 2,
    TurnSeconds: 90, Status: status, Seed: seed, HostUserID: 1, DataVersion: dv,
  };
}

describe('PlayClient', () => {
  it('init 重放 journal:状态与哈希一致推进', () => {
    const { c, states } = makeClient();
    // 用同种子引擎预生成 3 步 journal
    let g = createGame({ seed: 42, playerCount: 2 });
    const journal = [];
    for (let i = 0; i < 3; i++) {
      const m = autopilotPick(g)!;
      g = applyMove(g, m);
      journal.push({ seq: i + 1, userId: 0, move: m, hash: '' });
    }
    c.handle(JSON.stringify({ t: 'init', room: roomJson(42), players: [], journal, name: 't' }));
    const s = states.at(-1)!;
    expect(s).toBeTruthy();
    expect(c.seq).toBe(3);
    // 与本地直推状态一致性:行动者相同
    expect(s!.turn.player).toBe(g.turn.player);
  });

  it('move 乱序触发 REST 重同步', async () => {
    const fetched: { url: string }[] = [];
    let g = createGame({ seed: 7, playerCount: 2 });
    const m1 = autopilotPick(g)!;
    g = applyMove(g, m1);
    const { c } = makeClient();
    c.fetchImpl = (async (url: string) => {
      fetched.push({ url: String(url) });
      return new Response(JSON.stringify({
        room: roomJson(7),
        journal: [{ seq: 1, userId: 0, move: m1, hash: '' }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    c.handle(JSON.stringify({ t: 'init', room: roomJson(7), players: [], journal: [], name: 't' }));
    // 直接投 seq=2(缺 seq=1)→ 触发 resync
    c.handle(JSON.stringify({ t: 'move', seq: 2, userId: 0, move: { t: 'takeWorkers', die: 0 }, hash: '' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetched.length).toBeGreaterThanOrEqual(1);
    expect(c.seq).toBe(1);
  });

  it('timeout 触发确定性代走消息(timeout 标记)', () => {
    const { c, sent } = makeClient();
    c.handle(JSON.stringify({ t: 'init', room: roomJson(42), players: [], journal: [], name: 't' }));
    sent.length = 0;
    c.handle(JSON.stringify({ t: 'timeout', turnSeconds: 90 }));
    const moveMsgs = sent.filter((x) => (x as { t: string }).t === 'move');
    expect(moveMsgs.length).toBe(1);
    const mm = moveMsgs[0] as { timeout: boolean; seq: number; move: Move };
    expect(mm.timeout).toBe(true);
    expect(mm.seq).toBe(1);
    expect(mm.move).toBeTruthy();
  });

  it('submitMove 发送意图且不本地推进', () => {
    const { c, sent, states } = makeClient();
    c.handle(JSON.stringify({ t: 'init', room: roomJson(42), players: [], journal: [], name: 't' }));
    const before = c.state!;
    const nBefore = states.length;
    const m = autopilotPick(before)!;
    const ok = c.submitMove(before, m);
    expect(ok).toBe(true);
    const mm = sent.find((x) => (x as { t: string }).t === 'move') as { hash: string; next: number };
    expect(mm.hash.length).toBe(16);
    expect(c.state).toBe(before);           // 未本地推进
    expect(states.length).toBe(nBefore);    // 无新状态事件
  });

  it('数据指纹:不一致触发 onVersionMismatch,一致/空版本不触发', () => {
    const a = makeClient();
    a.c.handle(JSON.stringify({ t: 'init', room: roomJson(42, 'playing', 'dv1-deadbeef'), players: [], journal: [], name: 't' }));
    expect(a.mismatches).toEqual([['dv1-deadbeef', dataVersion()]]);

    const b = makeClient();
    b.c.handle(JSON.stringify({ t: 'init', room: roomJson(42, 'playing', dataVersion()), players: [], journal: [], name: 't' }));
    expect(b.mismatches).toHaveLength(0);   // 一致

    const d = makeClient();
    d.c.handle(JSON.stringify({ t: 'init', room: roomJson(42), players: [], journal: [], name: 't' }));
    expect(d.mismatches).toHaveLength(0);   // 历史房间(空版本)跳过校验
  });
});

beforeEach(() => { void wsFactory; });

// ---------- 协议 fixture(TS⇄Go 单一事实源;Go 侧金测试在 server/internal/play/protocol_fixture_test.go) ----------
describe('protocol fixture(TS⇄Go 同源)', () => {
  const fx = protocolFixture as {
    serverRoom: ServerRoom; serverPlayer: ServerPlayer; journalEntry: JournalEntry;
    serverMsgInit: Extract<ServerMsg, { t: 'init' }>; serverMsgMove: Extract<ServerMsg, { t: 'move' }>;
    clientMsgMove: ClientMsg;
  };

  it('ServerRoom/ServerPlayer/JournalEntry 字段与 fixture 对齐', () => {
    const room = fx.serverRoom;
    expect(room.ID).toBe('r01abc');
    expect(room.GameKey).toBe('burgundy');
    expect(room.Modules).toBe('["shields"]');
    expect(room.Seats).toBe(3);
    expect(room.TurnSeconds).toBe(90);
    expect(room.Status).toBe('playing');
    expect(room.Seed).toBe(424242);
    expect(room.HostUserID).toBe(7);
    expect(room.DataVersion).toBe('dv-test-0001');
    // Go 侧多发 CreatedAt,TS 类型未声明但字段不得丢
    expect((room as unknown as Record<string, unknown>).CreatedAt).toBe('2026-01-02T03:04:05Z');
    expect(fx.serverPlayer).toEqual({ UserID: 7, Username: 'host', Seat: 0, JoinedAt: '2026-01-02T03:04:05Z' });
    const j = fx.journalEntry;
    expect(j.seq).toBe(1);
    expect(j.userId).toBe(7);
    expect(j.hash).toBe('0123456789abcdef');
    expect(j.move).toEqual({ t: 'takeWorkers', die: 0 });
  });

  it('ServerMsg init/move 形状与 fixture 对齐', () => {
    const init = fx.serverMsgInit;
    expect(init.t).toBe('init');
    expect(init.name).toBe('host');
    expect(init.deadline).toBe(1767131045000);
    expect(init.room.ID).toBe('r01abc');
    expect(init.players[0].Seat).toBe(0);
    expect(init.journal[0].hash).toBe('0123456789abcdef');
    const mv = fx.serverMsgMove;
    expect(mv.t).toBe('move');
    expect(mv.seq).toBe(1);
    expect(mv.userId).toBe(7);
    expect(mv.hash).toBe('0123456789abcdef');
  });

  it('ClientMsg 字段与 fixture 对齐', () => {
    const cm = fx.clientMsgMove;
    expect(cm.t).toBe('move');
    expect(cm.seq).toBe(2);
    expect(cm.hash).toBe('fedcba9876543210');
    expect(cm.next).toBe(1);
    expect(cm.move).toEqual({ t: 'sell', die: 1, color: 3 });
  });
});
