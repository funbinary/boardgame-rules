// 白色城堡(第五扩展):放置时以白骰当前点数执行一个奖励行动。
// 效果接线:moves.resolvePlacement(放置触发 pending)与 legalMoves(白骰行动枚举);
// 自动机兼容(白堡入卡 → 拿板块入储备区)在 modules/automa.ts 的 onPlaced 链。
import type { ModuleHook } from '../modules';

export const whitecastleModule: ModuleHook = {
  onSetup(g) {
    // 白堡板块经 drawTile 洗入浅褐/黄/黑供应(exp5;占位配比 4彩褐/2彩黄/3黑)
    void g;
  },
};
