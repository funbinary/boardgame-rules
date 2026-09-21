// 扩展模块效果注册表:按模块开关路由到对应效果函数。
// 原则:模块内效果互不依赖;引擎主流程在对应节点查询模块钩子。
import type { GameState, Tile } from './state';
import type { ModuleId } from './types';

export interface ModuleHook {
  /** 建局时修改(版图/板块供应) */
  onSetup?: (g: GameState) => void;
  /** 放置板块后触发(返回额外 VP) */
  onPlace?: (g: GameState, player: number, tile: Tile, r: number, c: number) => number;
  /** 阶段开始时触发 */
  onPhaseStart?: (g: GameState) => void;
  /** 阶段结束时触发 */
  onPhaseEnd?: (g: GameState, player: number) => void;
  /** 终局计分加成 */
  onEndgame?: (g: GameState, player: number) => number;
}

const registry = new Map<ModuleId, ModuleHook>();

export function registerModule(id: ModuleId, hook: ModuleHook): void {
  registry.set(id, hook);
}

export function getModuleHook(id: ModuleId): ModuleHook | undefined {
  return registry.get(id);
}

export function callHook(
  g: GameState, name: keyof ModuleHook, ...args: unknown[]
): number {
  let vp = 0;
  for (const id of g.modules) {
    const h = registry.get(id);
    const fn = h?.[name];
    if (fn) {
      const r = (fn as (...a: unknown[]) => number)(g, ...args);
      if (typeof r === 'number') vp += r;
    }
  }
  return vp;
}

/** 调用指定模块的钩子(无返回值场景) */
export function callModule(
  id: ModuleId, g: GameState, name: keyof ModuleHook,
): void {
  const fn = registry.get(id)?.[name];
  if (fn) (fn as (...a: unknown[]) => unknown)(g);
}

/** 检查模块兼容性 */
export function validateModules(modules: ModuleId[], playerCount: number): string | null {
  const data = modulesData();
  for (const m of modules) {
    const mod = data.modules.find((x) => x.id === m);
    if (!mod) return `未知模块:${m}`;
    if (mod.minPlayers && playerCount < mod.minPlayers) return `${mod.name} 至少需要 ${mod.minPlayers} 人`;
    if (mod.maxPlayers && playerCount > mod.maxPlayers) return `${mod.name} 最多支持 ${mod.maxPlayers} 人`;
    if (mod.incompatible) {
      for (const other of modules) {
        if (mod.incompatible.includes(other)) return `${mod.name} 与 ${data.modules.find((x) => x.id === other)?.name ?? other} 不兼容`;
      }
    }
  }
  return null;
}

import modulesJson from './data/modules.json';
export function modulesData() { return modulesJson.data; }
