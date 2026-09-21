// 定位哈希分歧:拉 journal,逐步重放,比对每步"提交方哈希"与本地重算哈希。
import { applyMove } from '../src/play/burgundy/src/engine/moves';
import { createGame } from '../src/play/burgundy/src/engine/setup';
import { hashState } from '../src/play/burgundy/src/engine/hash';
import type { Move } from '../src/play/burgundy/src/engine/state';

const API = 'http://127.0.0.1:8787';
const roomID = process.argv[2];

let cookie = '';
{
  await fetch(API + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alice', password: 'alicePass1' }),
  }).then((r) => {
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
  });
}
const res = await fetch(`${API}/api/play/rooms/${roomID}`, { headers: { Cookie: cookie } });
const data = await res.json();
const room = data.room;
const journal = data.journal ?? [];
console.log('room', room.ID, 'seed', room.Seed, 'status', room.Status, 'journal', journal.length);

let g = createGame({ seed: room.Seed, playerCount: room.Seats });
console.log('初始哈希', hashState(g));
console.log('初始诊断: status=%s pending=%d startPlayer=%d boards=%s rng=%d',
  g.status, g.pending.length, g.turn.player,
  g.players.map((p) => p.boardId).join(','), g.rng.s);
let bad = 0;
for (const e of journal) {
  let ok = '';
  try {
    const mv = typeof e.move === 'string' ? JSON.parse(e.move) : e.move;
    g = applyMove(g, mv as Move);
    const local = hashState(g);
    if (e.hash && e.hash !== local) {
      ok = `  ← 哈希分歧!提交方=${e.hash} 本地=${local} userId=${e.userId} type=${mv.t}`;
      bad++;
    }
  } catch (err) {
    ok = `  ← 重放失败:${err instanceof Error ? err.message : err}`;
    bad++;
  }
  console.log(`seq ${e.seq} ${(typeof e.move === 'string' ? e.move : JSON.stringify(e.move)).slice(0, 90)}${ok}`);
}
console.log(bad === 0 ? '本地重放全部一致' : `发现 ${bad} 处分歧`);
