// 第九扩展(团队游戏,2v2):共享资源路由与储存格统一视图。
// 设计:共享资源(工人/银币/货物/已售/奖励板块/公国/共享储存/修道院6号/城堡)全部挂在
// 队锚点(members[0])的 PlayerState 字段上 —— 引擎内所有 `p.workers`/`p.placed` 等读写
// 只需把 p 重绑为 resP(g, actor) 即可,不改动资源操作逻辑本身。
// 个人资源(骰子/私人储存格/个人分数/盾徽)留在各玩家对象上。
// 团队模式仅与基础+exp2 组合(modules.json 互斥清单),故盾徽/葡萄园等个人字段无需路由。
import type { GameState, PlayerState, TeamState, Tile } from '../state';

/** 承载 player 可用共享资源的玩家对象(团队=队锚点;非团队=本人) */
export function resP(g: GameState, player: number): PlayerState {
  const p = g.players[player];
  if (!g.teams || !p.team) return p;
  const t = g.teams[p.team];
  return g.players[t.members[0]];
}

/** 团队状态(无团队返回 null) */
export function teamOf(g: GameState, player: number): TeamState | null {
  const p = g.players[player];
  if (!g.teams || !p.team) return null;
  return g.teams[p.team];
}

/** 是否队锚点(共享资源的承载者) */
export function isAnchor(g: GameState, player: number): boolean {
  return resP(g, player).idx === player;
}

// ---------- 储存格统一视图:非团队 = 私人 3 格;团队 = 私人 2 格 + 共享 2 格(索引 0-3) ----------

/** 玩家可用的全部储存格(统一索引;返回数组是引用,可直接读写) */
export function storageSlots(g: GameState, player: number): (Tile | null)[] {
  const p = g.players[player];
  const t = teamOf(g, player);
  if (!t) return p.storage;
  return [...p.storage, ...t.sharedStorage];
}

/** 储存格总数(盾徽4扩容前的基础容量) */
export function storageSize(g: GameState, player: number): number {
  const p = g.players[player];
  const t = teamOf(g, player);
  return t ? p.storage.length + t.sharedStorage.length : p.storage.length;
}

/** 写回统一索引 → 底层存储(团队模式拆私人/共享) */
export function setSlot(g: GameState, player: number, idx: number, tile: Tile | null): void {
  const p = g.players[player];
  const t = teamOf(g, player);
  if (!t) {
    p.storage[idx] = tile;
    return;
  }
  if (idx < p.storage.length) p.storage[idx] = tile;
  else t.sharedStorage[idx - p.storage.length] = tile;
}

/** 板块入储存格(统一视图;双生片占 2 格;盾徽4 无上限扩容仅私人区) */
export function fillStorageU(g: GameState, player: number, tile: Tile): void {
  const p = g.players[player];
  const need = tile.twin ? 2 : 1;
  let free = storageSlots(g, player).filter((s) => s == null).length;
  while (free < need && p.shields?.includes(4)) {
    p.storage.push(null);
    free++;
  }
  if (free < need) {
    throw new Error(tile.twin ? '储存格不足 2 格,先弃置' : '储存格已满,先弃置');
  }
  let done = 0;
  const total = storageSlots(g, player).length;
  for (let i = 0; i < total && done < need; i++) {
    if (storageSlots(g, player)[i] == null) {
      setSlot(g, player, i, tile);
      done++;
    }
  }
}

/** 按板块实例 id 清出储存格(双生片清 2 格;可能跨私人/共享) */
export function clearStorageU(g: GameState, player: number, tileId: number): void {
  const n = storageSlots(g, player).length;
  for (let i = 0; i < n; i++) {
    if (storageSlots(g, player)[i]?.id === tileId) setSlot(g, player, i, null);
  }
}

/** 有空储存格(盾徽4 视为有) */
export function storageFreeU(g: GameState, player: number): boolean {
  return storageSlots(g, player).some((s) => s == null) || g.players[player].shields?.includes(4) === true;
}

/** 是否有 n 格连续……不要求连续,只要空闲 ≥ n(盾徽4 视为有) */
export function hasStorageForU(g: GameState, player: number, n: number): boolean {
  const free = storageSlots(g, player).filter((s) => s == null).length;
  return free >= n || g.players[player].shields?.includes(4) === true;
}
