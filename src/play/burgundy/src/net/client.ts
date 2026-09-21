// WS 客户端:指数退避重连、journal 重放、丢消息 REST 重同步、哈希对账、超时确定性代走。
// 单一事实源原则:走子不本地推进,等服务器广播回来重放(防 stale 拒绝后状态分叉)。
import { autopilotPick } from '../ai/autopilot';
import { actorOf, applyMove } from '../engine/moves';
import { hashState } from '../engine/hash';
import type { GameState, Move } from '../engine/state';
import type { JournalEntry, ServerMsg, ServerRoom } from './protocol';

export type NetStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface NetEvents {
  onStatus: (s: NetStatus) => void;
  onMsg: (m: ServerMsg) => void;
  onState: (g: GameState | null) => void;
  onDesync: (expected: string, got: string) => void;
}

/** 测试注入点:真实环境用浏览器 WebSocket */
export const wsFactory: (url: string) => WebSocketLike = (url) => new WebSocket(url) as unknown as WebSocketLike;

export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export class PlayClient {
  private ws: WebSocketLike | null = null;
  private retry = 0;
  private closed = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  state: GameState | null = null;
  seq = 0;
  room: ServerRoom | null = null;
  roomID = '';
  /** 服务器权威限时(unix 毫秒;0=无限时) */
  deadlineMs = 0;
  /** 测试注入:fetch(重同步用) */
  fetchImpl: (url: string) => Promise<Response> = (url) => fetch(url);

  constructor(
    roomID: string,
    private seedInit: (seed: number, modules: string[], playerCount: number) => GameState | null,
    private ev: NetEvents,
  ) {
    this.roomID = roomID;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/api/play/ws?room=${encodeURIComponent(this.roomID)}`;
    this.ev.onStatus('connecting');
    const ws = wsFactory(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.ev.onStatus('open');
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 25000);
    };
    ws.onmessage = (e) => this.handle(String(e.data));
    ws.onclose = () => {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      if (this.closed) { this.ev.onStatus('closed'); return; }
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      this.ev.onStatus('reconnecting');
      setTimeout(() => { if (!this.closed) this.connect(); }, delay);
    };
    ws.onerror = () => { /* onclose 跟进 */ };
  }

  close() { this.closed = true; this.ws?.close(); }

  send(obj: unknown) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  /** UI 走子:本地试算(校验合法+得哈希)后发意图;不推进本地状态 */
  submitMove(state: GameState, move: Move): boolean {
    let next: GameState;
    try { next = applyMove(state, move); } catch { return false; }
    this.send({
      t: 'move', seq: this.seq + 1, move, hash: hashState(next),
      next: next.status === 'ended' ? -1 : actorOf(next),
    });
    return true;
  }

  /** 服务器超时广播:各端各自计算同一确定性代走,先到先入 journal */
  autopilotOnTimeout() {
    if (!this.state || this.state.status === 'ended') return;
    const m = autopilotPick(this.state);
    if (!m) return;
    this.send({ t: 'move', seq: this.seq + 1, move: m, hash: '', next: -1, timeout: true });
  }

  /** 供测试直接注入服务器消息 */
  handle(raw: string) {
    let m: ServerMsg;
    try { m = JSON.parse(raw); } catch { return; }
    this.ev.onMsg(m);
    if (m.t === 'init') {
      this.room = m.room;
      this.deadlineMs = m.deadline ?? 0;
      this.replay(m.journal ?? []);
    } else if (m.t === 'started') {
      this.room = m.room;
      this.replay([]);
    } else if (m.t === 'deadline') {
      this.deadlineMs = m.deadline;
    } else if (m.t === 'move') {
      if (m.seq !== this.seq + 1) {
        void this.resync();
        return;
      }
      this.seq = m.seq;
      if (this.state) {
        try {
          this.state = applyMove(this.state, m.move as Move);
          const got = hashState(this.state);
          if (m.hash && got !== m.hash) this.ev.onDesync(m.hash, got);
        } catch {
          void this.resync();
          return;
        }
      }
      this.ev.onState(this.state);
    } else if (m.t === 'timeout') {
      this.autopilotOnTimeout();
    }
  }

  private replay(journal: JournalEntry[]) {
    const r = this.room;
    if (!r || r.Seed === 0) {
      this.state = null;
      this.seq = journal.length ? journal[journal.length - 1].seq : 0;
      this.ev.onState(null);
      return;
    }
    let g = this.seedInit(r.Seed, JSON.parse(r.Modules || '[]') as string[], r.Seats);
    if (!g) { this.state = null; return; }
    for (const e of journal) {
      try {
        // 兼容历史双重编码:move 可能是对象或 JSON 字符串
        const mv = typeof e.move === 'string' ? (JSON.parse(e.move) as Move) : (e.move as Move);
        g = applyMove(g, mv);
      } catch { break; }
    }
    this.state = g;
    this.seq = journal.length ? journal[journal.length - 1].seq : 0;
    this.ev.onState(g);
  }

  private async resync() {
    try {
      const res = await this.fetchImpl(`/api/play/rooms/${encodeURIComponent(this.roomID)}`);
      if (!res.ok) return;
      const data = await res.json();
      this.room = data.room;
      this.replay((data.journal ?? []) as JournalEntry[]);
    } catch { /* 下次消息再试 */ }
  }
}
