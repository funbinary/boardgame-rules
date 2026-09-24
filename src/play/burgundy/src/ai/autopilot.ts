// 确定性代走器(autopilot):联机超时/断线时由各客户端本地计算,同一状态必得同一走子。
// 注意:禁止 Math.random / Date;只依赖 GameState 本身。
import { applyMove, legalMoves } from '../engine/moves';
import { regionsOf } from '../engine/setup';
import type { GameState, Move } from '../engine/state';
import { loadBoards } from '../engine/data';

/** 简单启发式打分,保证"保底合法+不傻到卡死"。 */
export function autopilotPick(g: GameState): Move | null {
  const ms = legalMoves(g);
  if (!ms.length) return null;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const m of ms) {
    const s = scoreMove(g, m);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

function scoreMove(g: GameState, m: Move): number {
  switch (m.t) {
    case 'automa': return 120;                    // 自动机整回合:唯一选择
    case 'placeCastle': return 100;
    case 'answerShipGoods': return g.depots[m.depot - 1].goods ? 60 : 5;
    case 'answerTake': return 55;
    case 'answerWarehouseSell': return 50;
    case 'answerBonusDie': return 45;
    // P2 待决应答:可答即答,避免卡待决
    case 'answerShield5': return 58;
    case 'answerShield6': return 58;
    case 'answerFreePlace': return 57;
    case 'answerFreeBlack': return 56;
    case 'answerFreeTwin': return 56;
    case 'takeVineBonus': return 56;
    case 'skipFreePlace': return 3;
    case 'skipShieldFree': return 3;
    case 'place': {
      const p = g.players[g.turn.player];
      const tile = p.storage[m.storage];
      if (!tile) return -1;
      let s = 40;
      // 完成区域优先(粗略:区域内已放格数)
      const regs = regionsOf(p.boardId);
      const region = regs.regions[regs.regionOf[`${m.r}:${m.c}`]];
      const filled = region.cells.filter((k) => p.placed[k]).length;
      s += Math.min(region.cells.length, filled + 1) * 2;
      if (tile.color === 'green') s += (tile.animals ?? 0) * 2;
      if (tile.color === 'red' || tile.color === 'brown') s += 6;
      return s;
    }
    case 'sell': return 35;
    case 'take': return 30;
    case 'takeWorkers': return g.players[g.turn.player].workers <= 1 ? 25 : 8;
    case 'mon6Buy': return 20;
    case 'mon28BuyWorkers': return 18;
    case 'buyBlack': return g.players[g.turn.player].silver >= 4 ? 15 : -5;
    case 'buyInn': return 12;
    case 'takeShield': case 'takeShieldFree': return 52;   // 盾徽必拿(对子/免费机会)
    case 'setDie': return -15;                    // 改骰是手段不是目的,不主动用
    case 'takeTwin': return 28;
    case 'placeTwin': return 42;
    case 'modDie': {
      // 代走器不主动改骰(legalMoves 已含直接可行的动作)
      return -20;
    }
    case 'discardStorage': return -50;
    default: return 0;
  }
}

/** 走完当前玩家的整回合(超时兜底):循环走子直到行动者切换或对局结束 */
export function autopilotTurn(g: GameState, maxSteps = 24): GameState {
  let cur = g;
  const startActor = cur.turn.player;
  for (let i = 0; i < maxSteps; i++) {
    if (cur.status === 'ended') return cur;
    const actorNow = cur.pending.length ? cur.pending[cur.pending.length - 1].player : cur.turn.player;
    if (actorNow !== startActor && cur.status !== 'placingCastles') return cur;
    const m = autopilotPick(cur);
    if (!m) return cur;
    cur = applyMove(cur, m);
  }
  return cur;
}

/** 板面覆盖率(终局评估用) */
export function coverageOf(g: GameState, player: number): number {
  const p = g.players[player];
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return 0;
  return Object.keys(p.placed).length / b.cells.length;
}
