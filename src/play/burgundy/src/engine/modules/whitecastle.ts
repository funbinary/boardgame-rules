// 白色城堡(第五扩展):按白骰点数执行一个额外行动。
import type { GameState, Tile } from '../state';
import type { ModuleHook } from '../modules';

export const whitecastleModule: ModuleHook = {
  onSetup(g) {
    // 9 个白堡洗入建筑/修道院/黑区供应(由 drawTile 按概率抽)
  },
  onPlace(g, player, tile) {
    // 白堡放置时:用白骰点数执行一个额外行动(不消耗骰子)
    // 引擎已在 moves.ts 的 resolvePlacement 中处理 bonusAction
    return 0;
  },
};
