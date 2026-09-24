// 盾徽扩展(P2):对子骰拿盾徽 → 放城堡(可替换)→ 持续效果;阶段末纳贡(1银/盾,盾徽3可工人代付,
// 付不起则移除)。18 种效果(编号=盾徽号,规则书 p17-18):
//  1 牧场连通(终局12)  2 他人获工人+1(12)  3 工人代纳贡(12)  4 储存无上限(12)
//  5 放船选色全取货物(12)  6 复制目标玩家修道院(12)  7 奖励板块分×2(8)  8 银矿产银×2(8)
//  9 出售每货物+1银(8)  10 计分类修道院终局×2(8)  11 放城堡免费拿盾徽(8)  12 出售货物分×2(8)
//  13 全部盾徽终局分×2(4)  14 阶段末从补给区免费放置(4)  15 同14但黑区(4)  16 区域完成规模+1(4)
//  17 放置无需邻接(4)  18 每回合一次改骰为任意点(4)
import type { GameState, PlayerState } from '../state';
import type { ModuleHook } from '../modules';
import { shuffle } from '../rng';

/** 盾徽终局分表:1-6=12,7-12=8,13-18=4(规则书 p18) */
export const SHIELD_END_VP: Record<number, number> = {
  1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12,
  7: 8, 8: 8, 9: 8, 10: 8, 11: 8, 12: 8,
  13: 4, 14: 4, 15: 4, 16: 4, 17: 4, 18: 4,
};

export function hasShield(p: PlayerState, n: number): boolean {
  return p.shields?.includes(n) ?? false;
}

export const shieldsModule: ModuleHook = {
  onSetup(g) {
    // 18 个盾徽洗混;自动机模式下 2 号先移除(规则书 p27)。随机性走 GameState.rng
    let pool = Array.from({ length: 18 }, (_, i) => i + 1);
    if (g.modules.includes('automa')) pool = pool.filter((n) => n !== 2);
    const [sh, r0] = shuffle(g.rng, pool);
    g.rng = r0;
    // 人数分布:2p 每区1 / 3p 1,3,5区1+2,4,6区2 / 4p 每区2
    const count = (n: number): number =>
      g.playerCount === 2 ? 1 : g.playerCount === 3 ? (n % 2 === 1 ? 1 : 2) : 2;
    let k = 0;
    for (const d of g.depots) {
      d.shields = [];
      for (let i = 0; i < count(d.n); i++) d.shields.push(sh[k++] ?? 0);
    }
    g.log.push({ text: `盾徽:按人数分置于补给区货物格(${g.playerCount}人,余者不用${g.modules.includes('automa') ? ';2号已移除' : ''})` });
  },
  onEndgame(g, player) {
    const p = g.players[player];
    if (!p.shields?.length) return 0;
    const base = p.shields.reduce((s, n) => s + (SHIELD_END_VP[n] ?? 0), 0);
    return hasShield(p, 13) ? base * 2 : base;
  },
};

/** 阶段末纳贡(银矿产银前调用):每盾 1 银;盾徽3 可 1 工人代付;付不起移除 */
export function shieldsTribute(g: GameState, player: number): void {
  const p = g.players[player];
  if (!p.shields?.length) return;
  const canWorker = hasShield(p, 3);
  for (const s of [...p.shields]) {
    const i = p.shields.indexOf(s);
    if (p.silver >= 1) {
      p.silver -= 1;
      g.log.push({ player, text: `盾徽纳贡:盾徽${s} -1银币` });
    } else if (canWorker && p.workers >= 1) {
      p.workers -= 1;
      g.log.push({ player, text: `盾徽纳贡:盾徽${s} -1工人(盾徽3代付)` });
    } else {
      p.shields.splice(i, 1);
      g.log.push({ player, text: `盾徽纳贡失败:盾徽${s} 被移除` });
    }
  }
}

/** 公国中已放置的城堡数(含初始城堡)= 盾徽容量上限 */
export function castleCapacity(g: GameState, player: number): number {
  return Object.values(g.players[player].placed).filter((t) => t.color === 'red').length;
}

/** 从补给区拿盾徽(公共逻辑);返回是否成功 */
export function pickShield(g: GameState, player: number, depotN: number, idx: number, free: boolean, replace?: number): boolean {
  const p = g.players[player];
  const depot = g.depots[depotN - 1];
  if (!depot?.shields?.length) throw new Error('该补给区无盾徽');
  if (idx < 0 || idx >= depot.shields.length) throw new Error('盾徽序号越界');
  const shield = depot.shields[idx];
  const cap = castleCapacity(g, player);
  if (!p.shields) p.shields = [];
  if (p.shields.length >= cap) {
    if (replace == null || replace < 0 || replace >= p.shields.length) {
      throw new Error(`城堡已满(${cap}),需指定替换的盾徽`);
    }
    const old = p.shields[replace];
    p.shields[replace] = shield;
    g.log.push({ player, text: `盾徽${old} 被替换移除,新盾徽${shield} 上城` });
  } else {
    p.shields.push(shield);
    g.log.push({ player, text: `${free ? '免费拿取' : '对子拿取'}盾徽${shield}(补给区${depotN})` });
  }
  depot.shields.splice(idx, 1);
  if (shield === 6) {
    // 盾徽6:选复制目标(待决;自动机目标亦可,规则书 p27)
    g.pending.push({ kind: 'shield6Target', player });
  }
  return true;
}

