// 对局流转:回合结束 → 轮次推进 → 阶段结算 → 终局。
// settle() 由 moves.applyMove 在每次状态变更后调用(幂等:条件不满足时无操作)。
import { loadBoards } from './data';
import { beginPhase, rollRound, trackOrder } from './setup';
import { endgameScore, addVP } from './scoring';
import type { GameState } from './state';

/** 行动与待决全部清空时推进对局(可能连续推进多步) */
export function settle(g: GameState) {
  if (g.status !== 'playing') return;
  let guard = 8;
  while (guard-- > 0) {
    if (g.pending.length > 0) {
      // 自愈:市政厅待决但已无可放置板块(后续状态变化使其失效)→ 落空
      const top = g.pending[g.pending.length - 1];
      if (top.kind === 'bonusAction' && top.from === 'cityhall' && !bonusPlaceable(g, top.player)) {
        g.pending.pop();
        g.turn.bonusDice.pop();
        g.log.push({ player: top.player, text: '市政厅无可放置板块,落空' });
        continue;
      }
      return;
    }
    const t = g.turn;
    // 自愈:骰子用尽、仅剩无法使用的奖励行动 → 落空
    if (t.bonusDice.length > 0 && t.used[0] && t.used[1] && !bonusPlaceable(g, t.player)) {
      t.bonusDice.pop();
      g.log.push({ player: t.player, text: '奖励行动无法使用,落空' });
      continue;
    }
    const diceLeft = !t.used[0] || !t.used[1] || t.bonusDice.length > 0;
    if (diceLeft) return;
    // ---- 回合结束 ----
    g.roundPlayed.push(t.player);
    if (g.roundPlayed.length < g.playerCount) {
      const order = trackOrder(g);
      const next = order.find((i) => !g.roundPlayed.includes(i));
      if (next == null) return;
      startTurn(g, next);
      continue;
    }
    // ---- 轮次结束 ----
    if (g.round < 5) {
      g.round++;
      g.roundPlayed = [];
      rollRound(g);
      continue;
    }
    // ---- 阶段结束 ----
    phaseEnd(g);
    if (g.phase >= 4) {
      endgameScore(g);
      return;
    }
    g.phase++;
    g.round = 1;
    g.roundPlayed = [];
    beginPhase(g);
    rollRound(g);
  }
}

function startTurn(g: GameState, player: number) {
  const p = g.players[player];
  g.turn = {
    player,
    dice: [...(p.lastRoll ?? [1, 1])] as [number, number],
    used: [false, false],
    bonusDice: [],
    blackBought: false,
  };
  p.mon6Used = false;
  g.log.push({ player, text: `${p.name} 的回合` });
}

/** 阶段结束效果:银矿产银(修道院2:另+工人);自动机郡县卡上的银矿同样产银(储备区不计) */
export function phaseEnd(g: GameState) {
  for (const p of g.players) {
    let mines = Object.values(p.placed).filter((t) => t.color === 'gray').length;
    if (p.automa) {
      for (const card of p.automa.cards) {
        if (!card) continue;
        mines += card.cells.filter((c) => c.filled?.color === 'gray').length;
      }
    }
    if (mines > 0) {
      p.silver += mines;
      // 自动机忽略修道院效果(规则书 p23)
      const mon2 = !p.isAutoma && Object.values(p.placed).some((t) => t.monastery === 2);
      if (mon2) p.workers += mines;
      g.log.push({ player: p.idx, text: `阶段结束:${mines}银矿产银(+${mines}银币${mon2 ? `,修道院2:+${mines}工人` : ''})` });
    }
  }
  void addVP;
}

/** 顺位轨推进 1 格(同格压顶;27号修道院持有者永远在顶部) */
export function advanceTrack(g: GameState, player: number) {
  for (let s = g.track.length - 1; s >= 0; s--) {
    const i = g.track[s].indexOf(player);
    if (i >= 0) {
      g.track[s].splice(i, 1);
      if (s + 1 >= g.track.length) g.track.push([]);
      const target = g.track[s + 1];
      const mon27idx = target.findIndex((q) => q !== player && Object.values(g.players[q].placed).some((t) => t.monastery === 27));
      if (mon27idx >= 0) target.splice(mon27idx, 0, player);   // 插到 27 号持有者下方
      else target.push(player);
      g.log.push({ player, text: '顺位轨推进' });
      return;
    }
  }
}

/** 奖励行动(自由点数)是否还有可放置目标:储存格有板块,且存在同色空格与其已放板块相邻 */
function bonusPlaceable(g: GameState, player: number): boolean {
  const p = g.players[player];
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return false;
  const tiles = p.storage.filter((s): s is NonNullable<typeof s> => s != null);
  if (!tiles.length) return false;
  const placedKeys = new Set(Object.keys(p.placed));
  const isFirst = placedKeys.size <= 1;
  for (const cell of b.cells) {
    const key = `${cell.r}:${cell.c}`;
    if (placedKeys.has(key)) continue;
    if (!tiles.some((t) => t.color === cell.color)) continue;
    // 邻接:首块须邻初始城堡,其余须邻任一已放板块
    const even = cell.r % 2 === 0;
    const dirs = even
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    const adjacent = dirs.some(([dr, dc]) => {
      const nk = `${cell.r + dr}:${cell.c + dc}`;
      return isFirst ? nk === p.castleCell : placedKeys.has(nk);
    });
    if (adjacent) return true;
  }
  return false;
}
