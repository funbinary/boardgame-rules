// 盾徽扩展:对子骰拿盾徽,持续效果+纳贡。
import type { GameState, Tile } from '../state';
import type { ModuleHook } from '../modules';
import { addVP } from '../scoring';

export const shieldsModule: ModuleHook = {
  onSetup(g) {
    for (const d of g.depots) {
      const count = g.playerCount === 2 ? 1 : g.playerCount === 3 ? (d.n % 2 === 1 ? 1 : 2) : 2;
      d.shields = Array.from({ length: count }, (_, i) => i + 1);
    }
  },
  onPhaseEnd(g, player) {
    const p = g.players[player];
    if (!p.shields) return;
    for (const s of p.shields) {
      if (p.silver >= 1) {
        p.silver -= 1;
        g.log.push({ player, text: `盾徽纳贡:-1银币(盾徽${s})` });
      } else {
        g.log.push({ player, text: `盾徽纳贡失败,盾徽${s}被移除` });
        // 实际移除逻辑在后续处理
      }
    }
  },
};

/** 对子骰拿盾徽(在 applyMove 中处理) */
export function shieldsPick(g: GameState, player: number, depotN: number): boolean {
  const p = g.players[player];
  if (!p.shields) p.shields = [];
  const depot = g.depots[depotN - 1];
  if (!depot.shields || depot.shields.length === 0) return false;
  const shield = depot.shields.shift()!;
  p.shields.push(shield);
  g.log.push({ player, text: `盾徽:从补给区${depotN}拿取盾徽${shield}` });
  return true;
}
