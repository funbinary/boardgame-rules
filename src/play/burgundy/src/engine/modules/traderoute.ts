// 商路(第八扩展,P2):每人按人数获得商路板块(4p:3 / 3p:4 / 2p:5,每块 3 格),洗混横向相连。
// 出售货物时货物自左而右逐个上商路格(不再进已售堆);货物点数与格上点数匹配 → 立即获得所示奖励;
// 商路填满后出售的货物照常进已售堆。自动机兼容:不用商路,每次出售行动 +1 分(已在 automa.ts)。
// 逐格奖励数据为占位(traderoute.json _meta,confidence: low)。
import type { GameState, PlayerState } from '../state';
import type { ModuleHook } from '../modules';
import { loadTradeRoutes, type TradeReward } from '../data';
import { shuffle } from '../rng';

export const traderouteModule: ModuleHook = {
  onSetup(g) {
    const tiles = loadTradeRoutes().tiles;
    const n = g.playerCount === 2 ? 5 : g.playerCount === 3 ? 4 : 3;
    // 12 块商路板块全场共享:一次性洗混后按人发牌(4p 3块×4人=12 / 3p 4块×3人=12 / 2p 5块×2人)
    const [order, r1] = shuffle(g.rng, tiles.map((t) => t.id));
    g.rng = r1;
    g.players.forEach((p, pi) => {
      const mine = order.slice(pi * n, pi * n + n);
      const spaces: { n: number; reward: TradeReward; good?: number }[] = [];
      for (const id of mine) {
        const t = tiles.find((x) => x.id === id)!;
        spaces.push(...t.spaces.map((s) => ({ ...s })));
      }
      p.tradeRoute = spaces;
      p.tradeRoutePlaced = 0;
    });
    g.log.push({ text: `商路:每人 ${n} 块商路板块(${n * 3} 格)横向相连` });
  },
};

/** 出售的货物是否还能上商路格 */
export function routeHasSpace(p: PlayerState): boolean {
  return !!p.tradeRoute && (p.tradeRoutePlaced ?? 0) < p.tradeRoute.length;
}

/** 货物上商路格;点数匹配则返回应发放的奖励(发放由 moves.ts 统一结算) */
export function routePlaceGood(p: PlayerState, goodValue: number): TradeReward | null {
  if (!routeHasSpace(p)) return null;
  const space = p.tradeRoute![p.tradeRoutePlaced!];
  space.good = goodValue;
  p.tradeRoutePlaced = (p.tradeRoutePlaced ?? 0) + 1;
  return space.n === goodValue ? space.reward : null;
}
