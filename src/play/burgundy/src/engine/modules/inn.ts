// 旅店(第六扩展):旅店提升区域规模。
import type { GameState, Tile } from '../state';
import type { ModuleHook } from '../modules';
import { SIZE_VP } from '../scoring';

export const innModule: ModuleHook = {
  onSetup(g) {
    g.innPile = 5;
  },
  onPlace(g, player, tile) {
    // 旅店自身无即时效果
    return 0;
  },
  onEndgame(g, player) {
    return 0;
  },
};

/** 区域完成时若含旅店,规模+1 */
export function innBoostedSize(regionCells: string[], placed: Record<string, Tile>): number {
  const hasInn = regionCells.some((k) => placed[k]?.inn);
  return regionCells.length + (hasInn ? 1 : 0);
}
