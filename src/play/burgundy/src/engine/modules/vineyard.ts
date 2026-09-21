// 葡萄园扩展:双生六角片与葡萄藤计分。
import type { GameState, Tile } from '../state';
import type { ModuleHook } from '../modules';
import { addVP } from '../scoring';

export const vineyardModule: ModuleHook = {
  onSetup(g) {
    g.vineyard = {
      twinsSupply: [],
      shopSlots: [],
    };
  },
  onEndgame(g, player) {
    const p = g.players[player];
    if (!p.vineyard) return 0;
    let vp = 0;
    for (const bonus of p.vineyard.bonusTiles) {
      // 找同类型最大区域
      const regions = p.vineyard.regions.filter((r) => r.type === bonus.type);
      if (regions.length) {
        const maxSize = Math.max(...regions.map((r) => r.size));
        vp += VINE_SCORES[Math.min(maxSize, 13) - 1];
      }
    }
    return vp;
  },
};

const VINE_SCORES = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91];

/** 放置双生六角片到葡萄园版图 */
export function placeTwin(g: GameState, player: number, tile: Tile, layer: number, slot: number): boolean {
  const p = g.players[player];
  if (!p.vineyard) p.vineyard = { tiles: [], regions: [], bonusTiles: [] };
  p.vineyard.tiles.push(tile);
  // 简化:记录区域并计分
  g.log.push({ player, text: `放置双生六角片(葡萄园层${layer})` });
  return true;
}
