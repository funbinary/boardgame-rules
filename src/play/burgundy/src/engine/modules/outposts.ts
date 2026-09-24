// 边境哨所(第四扩展,P2):版图 23-30 每格带 outpost 序号(1-3)。
//  - 2 个哨所经已放板块连通 → 按当前阶段得分(10/8/6/4/2,每对只结一次)。
//  - 3 个哨所全部连通 → 领主版图奖励板块:第一位 5/6/7 分(按人数),第二位 2/3/4 分,之后无奖。
// 引擎按连通分量判定(与具体路径无关);版图 23-30 逐格数据待勘定(boards.json 空缺,机制就绪)。
// 由于哨所规则位于玩家版图层,任何带 outpost 标记的版图均可启用本扩展(规则书 p14 注意)。
import type { DuchyBoard } from '../types';
import type { GameState } from '../state';
import { addVP } from '../scoring';

/** 哨所连通判定:返回每个哨所序号所属连通分量 id(遍历全部已放格;中间板块同样导通) */
export function outpostComponents(board: DuchyBoard, placedKeys: Set<string>): Map<number, string> {
  const boardKeys = new Set(board.cells.map((c) => `${c.r}:${c.c}`));
  const compOf = new Map<number, string>();
  const seen = new Set<string>();
  const even = (r: number) => r % 2 === 0;
  const dirsOf = (r: number): [number, number][] => even(r)
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  for (const start of board.cells) {
    const sk = `${start.r}:${start.c}`;
    if (seen.has(sk) || !placedKeys.has(sk)) continue;
    const id = `c${compOf.size + seen.size}`;
    const stack = [start];
    seen.add(sk);
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.outpost != null) compOf.set(cur.outpost, id);
      for (const [dr, dc] of dirsOf(cur.r)) {
        const nk = `${cur.r + dr}:${cur.c + dc}`;
        if (seen.has(nk) || !placedKeys.has(nk) || !boardKeys.has(nk)) continue;
        const nb = board.cells.find((x) => `${x.r}:${x.c}` === nk)!;
        seen.add(nk);
        stack.push(nb);
      }
    }
  }
  return compOf;
}

/** 放置板块后检查哨所连通(在 moves.resolvePlacement 调用);返回得分 */
export function outpostsCheck(g: GameState, player: number, board: DuchyBoard): number {
  if (!g.outpostClaims) g.outpostClaims = { done2: [], done3: [] };
  const placedKeys = new Set(Object.keys(g.players[player].placed));
  const comp = outpostComponents(board, placedKeys);
  // 统计每个连通分量内的哨所数(≥2 = 有哨所对连通;=3 = 全连通)
  const byComp = new Map<string, number>();
  for (const id of comp.values()) byComp.set(id, (byComp.get(id) ?? 0) + 1);
  const maxInComp = Math.max(0, ...byComp.values());
  if (maxInComp < 2) return 0;
  let vp = 0;
  // 2 哨所连通:按当前阶段计分(每玩家整局只结一次)
  if (!g.outpostClaims.done2.includes(player)) {
    vp = [10, 8, 6, 4, 2][g.phase] ?? 2;
    addVP(g, player, vp, '边境哨所:2哨所连通');
    g.outpostClaims.done2.push(player);
  }
  // 3 哨所全连通:奖励板块(第一位/第二位)
  if (maxInComp >= 3 && !g.outpostClaims.done3.includes(player)) {
    const order = g.outpostClaims.done3.length;
    g.outpostClaims.done3.push(player);
    if (order === 0) {
      const vp3 = g.playerCount === 2 ? 5 : g.playerCount === 3 ? 6 : 7;
      addVP(g, player, vp3, '边境哨所:3哨所连通·首位奖励板块');
    } else if (order === 1) {
      const vp3 = g.playerCount === 2 ? 2 : g.playerCount === 3 ? 3 : 4;
      addVP(g, player, vp3, '边境哨所:3哨所连通·次位奖励板块');
    } else {
      g.log.push({ player, text: '边境哨所:3哨所连通,奖励板块已发完(无分)' });
    }
  }
  return vp;
}
