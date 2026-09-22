// 葡萄园扩展:双生六角片与葡萄藤计分。
// P1 现状:自动机兼容所需的供应/商店/计分表已接入;真实玩家拿取/放置双生片
// (takeTwin/placeTwin)与葡萄园版图区域计分属 P2,引擎仍拒绝相应走子。
import type { GameState, Tile, VineBonus, VineColor } from '../state';
import type { ModuleHook } from '../modules';
import { addVP } from '../scoring';
import { randInt } from '../rng';
import { nextTileId } from '../setup';

export const vineyardModule: ModuleHook = {
  onSetup(g) {
    // 双生片供应(占位:12 片,藤色/奖励随机 —— 官方面谱待勘定)
    const vines: VineColor[] = ['red', 'white', 'yellow', 'green', 'blue', 'purple'];
    const bonuses: VineBonus[] = [
      'workers2', 'silver2', 'workers1', 'silver1', 'vp4', 'vp2',
      'takeShipLivestock', 'takeBuilding', 'takeMineMonasteryCastle',
      'freeBlack', 'freeTwin', 'extraAction',
    ];
    let r = g.rng;
    const supply: Tile[] = [];
    for (let i = 0; i < 12; i++) {
      const [a, r1] = randInt(r, vines.length);
      const [b, r2] = randInt(r1, vines.length);
      const [x, r3] = randInt(r2, bonuses.length);
      const [y, r4] = randInt(r3, bonuses.length);
      r = r4;
      supply.push({
        id: nextTileId(), color: 'green', black: false,
        twin: { vines: [vines[a], vines[b]], bonus: [bonuses[x], bonuses[y]] },
      });
    }
    g.rng = r;
    // 商店槽位(占位:2-3 人 3 槽 / 4 人 4 槽,待勘定)
    const slots = g.playerCount >= 4 ? 4 : 3;
    g.vineyard = { twinsSupply: supply, shopSlots: supply.slice(0, slots) };
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

/** 放置双生六角片到葡萄园版图(P2:真实玩家侧) */
export function placeTwin(g: GameState, player: number, tile: Tile, layer: number, slot: number): boolean {
  const p = g.players[player];
  if (!p.vineyard) p.vineyard = { tiles: [], regions: [], bonusTiles: [] };
  p.vineyard.tiles.push(tile);
  // 简化:记录区域并计分
  g.log.push({ player, text: `放置双生六角片(葡萄园层${layer})` });
  return true;
}
