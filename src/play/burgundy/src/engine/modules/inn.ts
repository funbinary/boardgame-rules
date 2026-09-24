// 旅店(第六扩展,P2):每阶段开始补给区旁 +1 旅店(共5);2 银币购入(与黑区购买共用每回合一次),
// 放置遵循常规规则但**不限颜色**(骰点/邻接照常);每区域限 1 座;旅店自身无效果,仅令完成区域规模 +1。
// 放置/区域加成的实现接线在 moves.ts / scoring.ts(避免与 setup.ts 循环依赖)。
// 自动机不支持本扩展(modules.json 互斥,规则书 p26)。
import type { GameState } from '../state';
import type { ModuleHook } from '../modules';

export const innModule: ModuleHook = {
  onSetup(g) {
    g.innPile = 0;   // beginPhase 每阶段 +1(阶段A开始时为 1)
  },
};
