// 商路(第八扩展):出售货物上商路格领奖。
import type { GameState } from '../state';
import type { ModuleHook } from '../modules';
import { addVP } from '../scoring';

export const traderouteModule: ModuleHook = {
  onSetup(g) {
    for (const p of g.players) {
      const n = g.playerCount === 2 ? 5 : g.playerCount === 3 ? 4 : 3;
      p.tradeRoute = Array.from({ length: n * 3 }, (_, i) => i % 6 + 1); // 循环点数
      p.tradeRoutePlaced = 0;
    }
  },
  onPlace(g, player, tile) {
    return 0;
  },
};

/** 卖货时按商路领奖(在 doSell 中调用) */
export function traderouteSellBonus(g: GameState, player: number, color: number, count: number): number {
  const p = g.players[player];
  if (!p.tradeRoute) return 0;
  let bonus = 0;
  for (let i = 0; i < count && p.tradeRoutePlaced! < p.tradeRoute.length; i++) {
    const target = p.tradeRoute[p.tradeRoutePlaced!];
    if (target === color) {
      bonus += 2;
      addVP(g, player, 2, '商路领奖');
    }
    p.tradeRoutePlaced!++;
  }
  return bonus;
}
