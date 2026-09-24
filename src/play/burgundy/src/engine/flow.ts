// 对局流转:回合结束 → 轮次推进 → 阶段结算 → 终局。
// settle() 由 moves.applyMove 在每次状态变更后调用(幂等:条件不满足时无操作)。
import { loadBoards } from './data';
import { beginPhase, rollRound, trackOrder } from './setup';
import { endgameScore, addVP } from './scoring';
import { hasShield, shieldsTribute } from './modules/shields';
import { resP, storageSlots } from './modules/team';
import { completedLayer } from './modules/vineyard';
import type { GameState } from './state';

/** 行动与待决全部清空时推进对局(可能连续推进多步) */
export function settle(g: GameState) {
  if (g.status !== 'playing') return;
  let guard = 16;
  while (guard-- > 0) {
    if (g.pending.length > 0) {
      // 自愈:待决项因状态变化失效时直接落空
      const top = g.pending[g.pending.length - 1];
      if (top.kind === 'bonusAction' && top.from === 'cityhall' && !bonusPlaceable(g, top.player)) {
        g.pending.pop();
        g.turn.bonusDice.pop();
        g.log.push({ player: top.player, text: '市政厅无可放置板块,落空' });
        continue;
      }
      if (top.kind === 'freePlace' && freePlaceMoves(g, top.player, top.from).length === 0) {
        g.pending.pop();
        g.log.push({ player: top.player, text: '盾徽14/15:无可放置板块,落空' });
        continue;
      }
      if (top.kind === 'shield5Take' && shield5Colors(g).length === 0) {
        g.pending.pop();
        g.log.push({ player: top.player, text: '盾徽5:无可取货物,落空' });
        continue;
      }
      if (top.kind === 'vineCheck') {
        // 层完成检查(非选择):覆盖全部层内空间 → 开放藤奖励板块领取
        g.pending.pop();
        const layer = completedLayer(g, top.player, top.space);
        if (layer != null) {
          g.pending.push({ kind: 'vineBonus', player: top.player });
          g.log.push({ player: top.player, text: `葡萄园:第${layer}层覆盖完成,可领藤奖励板块` });
        }
        continue;
      }
      if (top.kind === 'vineBonus' && (g.vineyard?.bonusPile.length ?? 0) === 0) {
        g.pending.pop();
        g.log.push({ player: top.player, text: '藤奖励板块供应堆已空,落空' });
        continue;
      }
      if (top.kind === 'tradeAnyTake') {
        const p2 = g.players[top.player];
        const free = storageSlots(g, top.player).filter((s) => s == null).length;
        const anyTile = g.depots.some((d) => d.cells.some((t) => !!t));
        if (!(free > 0 && anyTile)) {
          g.pending.pop();
          g.log.push({ player: top.player, text: '商路 takeAny:无可取板块,落空' });
          continue;
        }
        void p2;
      }
      if (top.kind === 'freeTwinTake' && twinSupplySlots(g).length === 0) {
        g.pending.pop();
        g.log.push({ player: top.player, text: '葡萄园补给区无双生片,落空' });
        continue;
      }
      if (top.kind === 'freeBlackTake' && blackShopOptions(g, top.player).length === 0) {
        g.pending.pop();
        g.log.push({ player: top.player, text: '黑区/商店无可取板块,落空' });
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
    if (t.shield11Offer && depotShieldOptions(g).length === 0) {
      t.shield11Offer = false;
      g.log.push({ player: t.player, text: '盾徽11:补给区已无盾徽,落空' });
      continue;
    }
    const diceLeft = !t.used[0] || !t.used[1] || t.bonusDice.length > 0 || !!t.shield11Offer;
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
    if (!g.phaseSettled) {
      g.phaseSettled = true;
      phaseEnd(g);
      if (g.pending.length > 0) return;      // 盾徽14/15:免费放置待决(答完再推进)
    }
    if (g.phase >= 4) {
      endgameScore(g);
      return;
    }
    g.phase++;
    g.round = 1;
    g.roundPlayed = [];
    g.phaseSettled = false;
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
  resP(g, player).mon6Used = false;   // 修道院6号每回合一次;团队下为队级
  g.log.push({ player, text: `${p.name} 的回合` });
}

/** 阶段结束:盾徽纳贡(银矿前)→ 银矿产银(盾徽8×2;修道院2:+工人,盾徽2:他人+1工人)→ 盾徽14/15 免费放置待决 */
export function phaseEnd(g: GameState) {
  for (const p of g.players) {
    if (g.teams && resP(g, p.idx).idx !== p.idx) continue;   // 团队:共享公国只按锚点结算一次
    // 盾徽纳贡(规则书 p17:在银矿产银前)
    if (!p.isAutoma) shieldsTribute(g, p.idx);
    let mines = Object.values(p.placed).filter((t) => t.color === 'gray').length;
    if (p.automa) {
      for (const card of p.automa.cards) {
        if (!card) continue;
        mines += card.cells.filter((c) => c.filled?.color === 'gray').length;
      }
    }
    if (mines > 0) {
      const silver = hasShield(p, 8) ? mines * 2 : mines;
      p.silver += silver;
      // 自动机忽略修道院效果(规则书 p23)
      const mon2 = !p.isAutoma && hasMonPlaced(p, 2);
      if (mon2) gainWorkers(g, p.idx, mines, `修道院2:+${mines}工人`);
      g.log.push({ player: p.idx, text: `阶段结束:${mines}银矿产银(+${silver}银币${hasShield(p, 8) ? ',盾徽8×2' : ''}${mon2 ? `,修道院2:+${mines}工人` : ''})` });
    }
    // 盾徽14/15:阶段末免费放置(待决;全体行动结束后结算)
    if (!p.isAutoma && p.shields?.length) {
      if (hasShield(p, 14)) g.pending.push({ kind: 'freePlace', player: p.idx, from: 'depot' });
      if (hasShield(p, 15)) g.pending.push({ kind: 'freePlace', player: p.idx, from: 'black' });
    }
  }
  void addVP;
}

/** 修道院持有判定(不含盾徽6复制——纳贡/产银不需要) */
function hasMonPlaced(p: { placed: Record<string, { monastery?: number }> }, n: number): boolean {
  return Object.values(p.placed).some((t) => t.monastery === n);
}

/** 获得工人(盾徽2:每当其他玩家获得工人,持有者 +1,规则书 p18);团队下工人共享走锚点 */
export function gainWorkers(g: GameState, player: number, n: number, reason: string): void {
  const p = resP(g, player);
  p.workers += n;
  g.log.push({ player, text: `${reason}(+${n}工人)` });
  for (const other of g.players) {
    if (other.idx === player || other.isAutoma) continue;
    if (hasShield(other, 2)) {
      other.workers += 1;
      g.log.push({ player: other.idx, text: `盾徽2:${g.players[player].name} 获得工人 → +1工人` });
    }
  }
}

// ---------- settle 自愈/枚举辅助(供 legalMoves 复用,经 moves.ts re-export) ----------

/** 盾徽5:可选货物色(补给区货物格上有货,且受 3 色上限约束) */
export function shield5Colors(g: GameState): number[] {
  const out = new Set<number>();
  for (const d of g.depots) if (d.goods) out.add(d.goods.color);
  return [...out];
}

/** 葡萄园补给区有片槽位下标 */
export function twinSupplySlots(g: GameState): number[] {
  if (!g.vineyard) return [];
  return g.vineyard.supply.map((s, i) => (s.tile ? i : -1)).filter((i) => i >= 0);
}

/** 盾徽免费拿取/黑区购买可选项:黑区格与商店槽 */
export function blackShopOptions(g: GameState, player: number): { source: 'black' | 'shop'; cell: number; twin: boolean }[] {
  const p = resP(g, player);
  const free = storageSlots(g, player).filter((s) => s == null).length;
  const out: { source: 'black' | 'shop'; cell: number; twin: boolean }[] = [];
  g.blackDepot.forEach((t, i) => { if (t && (free >= 1 || p.shields?.includes(4))) out.push({ source: 'black', cell: i, twin: false }); });
  if (g.vineyard) {
    g.vineyard.shopSlots.forEach((t, i) => { if (t && (free >= 2 || p.shields?.includes(4))) out.push({ source: 'shop', cell: i, twin: true }); });
  }
  return out;
}

/** 补给区仍有盾徽的选项(盾徽11 自愈用) */
export function depotShieldOptions(g: GameState): { depot: number; idx: number }[] {
  const out: { depot: number; idx: number }[] = [];
  g.depots.forEach((d, di) => d.shields?.forEach((_, i) => out.push({ depot: di + 1, idx: i })));
  return out;
}

/** 盾徽14/15 免费放置枚举(骰点不限;颜色匹配(黑面/旅店任意色)+ 邻接照常) */
export function freePlaceMoves(g: GameState, player: number, from: 'depot' | 'black'): { from: 'depot' | 'black'; depot?: number; cell: number; r: number; c: number }[] {
  const p = resP(g, player);
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return [];
  const free = freeStorageSlots(g, player);
  const out: { from: 'depot' | 'black'; depot?: number; cell: number; r: number; c: number }[] = [];
  const candidates: { tile: NonNullable<GameState['players'][number]['storage'][number]>; from: 'depot' | 'black'; depot?: number; cell: number }[] = [];
  if (from === 'depot') {
    g.depots.forEach((d, di) => d.cells.forEach((t, ci) => { if (t) candidates.push({ tile: t, from, depot: di + 1, cell: ci }); }));
  } else {
    g.blackDepot.forEach((t, ci) => { if (t) candidates.push({ tile: t, from, cell: ci }); });
  }
  for (const cand of candidates) {
    if (cand.tile.twin && free < 2) continue;
    for (const cell of b.cells) {
      const key = `${cell.r}:${cell.c}`;
      if (p.placed[key]) continue;
      const anyColor = cand.tile.black || cand.tile.inn;
      if (!anyColor && cell.color !== cand.tile.color) continue;
      if (!adjacentToPlaced(g, player, cell.r, cell.c)) continue;
      out.push({ from: cand.from, depot: cand.depot, cell: cand.cell, r: cell.r, c: cell.c });
    }
  }
  return out;
}

/** 空闲储存格数(盾徽4:视为有空间,放置时可扩容) */
export function freeStorageSlots(g: GameState, player: number): number {
  const p = resP(g, player);
  const free = storageSlots(g, player).filter((s) => s == null).length;
  if (free === 0 && p.shields?.includes(4)) return 1;
  return free;
}

/** 与已放板块相邻判定(盾徽17:免邻接) */
export function adjacentToPlaced(g: GameState, player: number, r: number, c: number): boolean {
  const p = resP(g, player);
  if (p.shields?.includes(17)) return true;
  const even = r % 2 === 0;
  const dirs = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  const isFirst = Object.keys(p.placed).length === 1;   // 仅初始城堡
  for (const [dr, dc] of dirs) {
    const k = `${r + dr}:${c + dc}`;
    if (isFirst ? k === p.castleCell : !!p.placed[k]) return true;
  }
  return false;
}

/** 顺位轨推进 1 格(同格压顶;27号修道院持有者永远在顶部)
 *  团队(第九扩展):放置船只时若标记已在轨道最后一格,则移到该格最顶(规则书 p15) */
export function advanceTrack(g: GameState, player: number) {
  if (g.teams) {
    let lastOcc = -1;
    for (let s = 0; s < g.track.length; s++) if (g.track[s].length > 0) lastOcc = s;
    const cur = g.track[lastOcc]?.indexOf(player) ?? -1;
    if (lastOcc >= 0 && cur >= 0) {
      g.track[lastOcc].splice(cur, 1);
      g.track[lastOcc].push(player);
      g.log.push({ player, text: '顺位轨:已在最后一格,移至最顶(团队规则)' });
      return;
    }
  }
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
  const p = resP(g, player);
  const slots = storageSlots(g, player);
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return false;
  const tiles = slots.filter((s): s is NonNullable<typeof s> => s != null);
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
