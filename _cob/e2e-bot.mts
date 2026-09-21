// E2E 机器人:第二个真实客户端。
// 登录 → 入座 → WS 连接(token 鉴权)→ 用与浏览器同一份 TS 引擎重放全部走子并校验哈希。
// 用法:npx vite-node _cob/e2e-bot.mts <roomID> [autoplots]
// autoplots:若 >0,机器人在自己回合代走 N 手(默认 0,只做重放校验+聊天)。
import { applyMove, actorOf, legalMoves } from '../src/play/burgundy/src/engine/moves';
import { createGame } from '../src/play/burgundy/src/engine/setup';
import { hashState } from '../src/play/burgundy/src/engine/hash';
import { autopilotPick } from '../src/play/burgundy/src/ai/autopilot';
import type { GameState, Move } from '../src/play/burgundy/src/engine/state';

const API = 'http://127.0.0.1:8787';
const roomID = process.argv[2];
if (!roomID) { console.error('用法: e2e-bot.mts <roomID> [autoplots]'); process.exit(1); }
const autoPlays = +(process.argv[3] ?? 0);

let cookie = '';
async function api(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, data: await res.json().catch(() => null) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 登录(不存在则注册)
  let r = await api('POST', '/api/login', { username: 'e2ebot', password: 'e2ebot1A' });
  if (r.status !== 200) {
    r = await api('POST', '/api/register', { username: 'e2ebot', password: 'e2ebot1A' });
    if (r.status !== 200) { console.error('注册失败', r); process.exit(1); }
    r = await api('POST', '/api/login', { username: 'e2ebot', password: 'e2ebot1A' });
  }
  const token = cookie.replace('rules_session=', '');
  console.log('[bot] 登录 OK, token len', token.length);

  r = await api('POST', `/api/play/rooms/${roomID}/join`);
  console.log('[bot] 入座:', r.status, JSON.stringify(r.data));
  if (r.status !== 200) process.exit(1);

  const ws = new WebSocket(`ws://127.0.0.1:8787/api/play/ws?room=${roomID}&token=${encodeURIComponent(token)}`);
  let state: GameState | null = null;
  let seq = 0;
  let mySeat = -1;
  let hashOK = 0, hashTotal = 0;
  const results: string[] = [];
  let lastSubmittedSeq = 0;   // 同一 seq 只提交一次(防消息重入导致重复提交竞态)

  ws.onopen = () => console.log('[bot] WS 已连接');
  ws.onclose = (e) => { console.log('[bot] WS 关闭', e.code, e.reason); finish(); };
  ws.onerror = () => { console.error('[bot] WS 错误'); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data));
    switch (m.t) {
      case 'init': {
        const room = m.room;
        mySeat = (m.players ?? []).find((p: { UserID: number; Username: string }) => p.Username === 'e2ebot')?.Seat ?? -1;
        console.log('[bot] init: seed=', room.Seed, 'status=', room.Status, 'mySeat=', mySeat, 'journal=', m.journal?.length ?? 0);
        if (room.Seed) {
          state = createGame({ seed: room.Seed, playerCount: room.Seats });
          for (const e of m.journal ?? []) {
            state = applyMove(state, e.move as Move);
            seq = e.seq;
            hashTotal++; hashOK++;   // 历史不校验(发起端哈希可能为空)
          }
        }
        break;
      }
      case 'started': {
        console.log('[bot] 对局开始,seed=', m.room.Seed);
        // 连接时是 lobby 的话 init 没有建局;现在补建并重放空 journal
        if (!state && m.room.Seed) {
          state = createGame({ seed: m.room.Seed, playerCount: m.room.Seats });
          seq = 0;
        }
        break;
      }
      case 'move': {
        if (m.seq !== seq + 1) { console.error('[bot] 序号断裂', m.seq, '期望', seq + 1); results.push('SEQ_GAP'); finish(); return; }
        seq = m.seq;
        lastSubmittedSeq = 0;
        try {
          state = applyMove(state!, m.move as Move);
          hashTotal++;
          if (m.hash) {
            const got = hashState(state!);
            if (got === m.hash) hashOK++;
            else { console.error('[bot] 哈希不一致! 期望', m.hash, '实得', got); results.push('HASH_MISMATCH'); finish(); return; }
          } else hashOK++;
        } catch (err) {
          console.error('[bot] 重放失败 @seq', m.seq, err);
          results.push('REPLAY_ERROR'); finish(); return;
        }
        if (seq % 10 === 0) console.log('[bot] 已重放', seq, '步;当前行动者', state && actorOf(state));
        break;
      }
      case 'chat':
        console.log('[bot] 聊天:', m.name, ':', m.text);
        break;
      case 'deadline': break;
      case 'timeout': console.log('[bot] 收到超时广播');
        break;
      default: break;
    }
    maybeAutoplay();
  };

  function maybeAutoplay() {
    if (!state || !autoPlays || state.status === 'ended') return;
    if (actorOf(state) !== mySeat) return;
    if (seq + 1 === lastSubmittedSeq) return;   // 本地已提交过这一步,等广播
    const m = autopilotPick(state);
    if (!m) return;
    const next = applyMove(state, m);
    lastSubmittedSeq = seq + 1;
    ws.send(JSON.stringify({ t: 'move', seq: seq + 1, move: m, hash: hashState(next), next: actorOf(next) }));
    console.log('[bot] 代走 seq', seq + 1);
  }

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    const verdict = results.length === 0 ? 'PASS' : 'FAIL:' + results.join(',');
    console.log(`[bot] 校验结果: ${verdict}(哈希 ${hashOK}/${hashTotal},共 ${seq} 步)`);
    if (state) {
      console.log('[bot] 终态: phase', state.phase, 'round', state.round, 'status', state.status,
        'vp', state.players.map((p) => p.vp).join('/'));
    }
    setTimeout(() => process.exit(results.length ? 1 : 0), 300);
  }

  // 空闲心跳 + 定期汇报
  setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping' })); }, 20000);

  // 5 分钟兜底退出
  setTimeout(() => { console.log('[bot] 超时退出'); results.push('TIMEOUT'); finish(); }, 5 * 60 * 1000);
  // 聊天冒烟
  setTimeout(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', text: 'e2e bot 就绪' })); }, 1000);
}

void main();
