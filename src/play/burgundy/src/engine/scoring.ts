// 计分常量与终局计分
import type { GameState, PlayerState, Tile } from './state';
import { regionsOf } from './setup';
import { loadBoards } from './data';
import { automaEndgameBreakdown } from './modules/automa';
import { hasShield } from './modules/shields';
import { vineyardEndgameVP } from './modules/vineyard';
import { resP } from './modules/team';
import { callHook } from './modules';

/** 区域规模 → 分(1-10;11+ 由旅店+盾徽16叠加造成,超出按 55 封顶) */
export const SIZE_VP = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
/** 阶段 A-E 完成区域额外分 */
export const PHASE_BONUS = [10, 8, 6, 4, 2];
/** 奖励板块分:第一位/第二位 × 玩家数 2/3/4 */
export function rewardVP(playerCount: number): [number, number] {
  return playerCount === 2 ? [5, 2] : playerCount === 3 ? [6, 3] : [7, 4];
}
/** 出售货物每枚分 */
export function sellPerVP(playerCount: number): number { return playerCount === 2 ? 2 : playerCount; }

export function addVP(g: GameState, player: number, vp: number, reason: string) {
  if (vp === 0) return;
  g.players[player].vp += vp;
  g.log.push({ player, text: `+${vp}分(${reason})` });
}

/** 玩家已放置的某颜色板块数 */
export function placedCount(p: PlayerState, color: string): number {
  return Object.values(p.placed).filter((t) => t.color === color).length;
}

/** 某颜色版图总格数(该玩家) */
export function colorTotal(p: PlayerState, color: string): number {
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) return 0;
  return b.cells.filter((c) => c.color === color).length;
}

/** 完成区域的应得分:旅店(+1 规模)+ 盾徽16(+1 规模) */
export function regionCompleteVP(g: GameState, player: number, regionCells: string[], regionColor: string): number {
  const p = g.players[player];
  let size = regionCells.length;
  if (g.modules.includes('exp6') && regionCells.some((k) => p.placed[k]?.inn)) size += 1;
  if (hasShield(p, 16)) size += 1;
  return (SIZE_VP[size] ?? 0) + PHASE_BONUS[g.phase];
}

/** 终局计分:返回每人明细并写 g.final */
export function endgameScore(g: GameState) {
  const perPlayer: { idx: number; breakdown: { label: string; vp: number }[] }[] = [];
  for (const p of g.players) {
    const bd: { label: string; vp: number }[] = [];
    if (g.teams && resP(g, p.idx).idx !== p.idx) {
      // 团队:共享资源项(货物/银币/工人/共享公国修道院)只在锚点上计一次;
      // 队员个人局中得分(放置/ sell 等)已在各自 vp 里。
      perPlayer.push({ idx: p.idx, breakdown: [{ label: '共享资源项已并入队友锚点', vp: 0 }] });
      continue;
    }
    if (p.automa) {
      // 自动机按官方终局口径单独计分(规则书 p25)
      bd.push(...automaEndgameBreakdown(g, p.idx));
    } else {
      const goodsN = Object.values(p.goods).reduce((s, arr) => s + arr.length, 0);
      bd.push({ label: '未出售货物×1', vp: goodsN });
      bd.push({ label: '银币×1', vp: p.silver });
      bd.push({ label: '工人÷2', vp: Math.floor(p.workers / 2) });
      // 修道院 15-26(计分类);盾徽10:分数×2
      const monMul = hasShield(p, 10) ? 2 : 1;
      const mons = Object.values(p.placed).filter((t): t is Tile & { monastery: number } => t.color === 'yellow' && t.monastery != null);
      for (const m of mons) {
        let vp = 0;
        let label = `修道院${m.monastery}`;
        switch (m.monastery) {
          case 15: {
            const kinds = new Set(p.soldGoods.map((x) => x.color));
            vp = kinds.size * 2; label += ':每已售种类×2'; break;
          }
          case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 23: {
            const type = monasteryBuilding(m.monastery);
            vp = Object.values(p.placed).filter((t) => t.building === type || (t.building === 'crane' && craneCountsAs(p, type))).length * 4;
            label += `:每${type}×4`; break;
          }
          case 24: {
            const kinds = new Set(Object.values(p.placed).filter((t) => t.livestock || t.goose).map((t) => t.livestock ?? 'goose'));
            vp = kinds.size * 4; label += ':每牲畜种类×4'; break;
          }
          case 25: vp = p.soldGoods.length; label += ':每已售货物×1'; break;
          case 26: vp = p.bonusTiles.length * 3; label += ':每奖励板块×3'; break;
          default: continue;
        }
        if (monMul > 1) label += '(盾徽10×2)';
        bd.push({ label, vp: vp * monMul });
      }
      // 盾徽6:复制目标的计分类修道院(按自己的建筑物数量计,规则书 p18)
      if (p.shieldTarget != null && p.shields?.includes(6)) {
        const target = g.players[p.shieldTarget];
        const targetMons = collectScoringMonasteries(g, target);
        for (const n of [...new Set(targetMons)]) {
          let vp = 0;
          let label = `盾徽6:复制${target.name}修道院${n}`;
          switch (n) {
            case 15: vp = new Set(p.soldGoods.map((x) => x.color)).size * 2; break;
            case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 23: {
              const type = monasteryBuilding(n);
              vp = Object.values(p.placed).filter((t) => t.building === type).length * 4; break;
            }
            case 24: vp = new Set(Object.values(p.placed).filter((t) => t.livestock || t.goose).map((t) => t.livestock ?? 'goose')).size * 4; break;
            case 25: vp = p.soldGoods.length; break;
            case 26: vp = p.bonusTiles.length * 3; break;
            default: continue;
          }
          bd.push({ label, vp });
        }
      }
      // 扩展模块终局加成(盾徽计分/葡萄园计分)
      const extra = callHook(g, 'onEndgame', p.idx);
      if (extra > 0) bd.push({ label: '扩展模块计分', vp: extra });
    }
    perPlayer.push({ idx: p.idx, breakdown: bd });
    addVP(g, p.idx, bd.reduce((s, x) => s + x.vp, 0), '终局计分');
  }
  void vineyardEndgameVP; // 葡萄园计分经 vineyardModule.onEndgame(callHook)接入
  g.final = { perPlayer };
  // 决胜:分高 → 空格少 → 顺位轨落后;与自动机平手时自动机胜(规则书 p25)
  const emptyOf = (p: PlayerState) => {
    const b = loadBoards().boards.find((x) => x.id === p.boardId);
    return b ? b.cells.length - Object.keys(p.placed).length : 99;
  };
  const trackPosOf = (p: PlayerState): number => {
    for (let s = g.track.length - 1; s >= 0; s--) {
      const st = g.track[s];
      for (let i = st.length - 1; i >= 0; i--) if (st[i] === p.idx) return g.track.length - s;
    }
    return 99;
  };
  const ranked = [...g.players].sort((a, b) => {
    if (a.vp !== b.vp) return b.vp - a.vp;
    if (a.isAutoma !== b.isAutoma) return a.isAutoma ? -1 : 1;
    return emptyOf(a) - emptyOf(b) || trackPosOf(a) - trackPosOf(b);
  });
  if (g.teams) {
    // 团队决胜:两队总分相加;平手时公国剩余空格少的队胜(规则书 p15)
    const total = (tid: 'A' | 'B') => g.teams![tid].members.reduce((s, i) => s + g.players[i].vp, 0);
    const empty = (tid: 'A' | 'B') => {
      const a = g.players[g.teams![tid].members[0]];
      const b = loadBoards().boards.find((x) => x.id === a.boardId);
      return b ? b.cells.length - Object.keys(a.placed).length : 99;
    };
    const [ta, tb] = [total('A'), total('B')];
    const winner = ta !== tb ? (ta > tb ? 'A 队' : 'B 队') : (empty('A') <= empty('B') ? 'A 队' : 'B 队');
    g.log.push({ text: `游戏结束,胜者:${winner}(A ${ta} : B ${tb}${ta === tb ? ',平手比空格' : ''})` });
    g.status = 'ended';
    return;
  }
  g.log.push({ text: `游戏结束,胜者:${ranked[0].name}(${ranked[0].vp}分)` });
  g.status = 'ended';
}

/** 修道院 16-23+29 对应的建筑类型(D3 勘定;17 瞭望塔/22 银行为规则书示例锚定) */
function monasteryBuilding(n: number): string {
  const map: Record<number, string> = {
    16: 'carpenter', 17: 'watchtower', 18: 'church', 19: 'cityhall', 20: 'market',
    21: 'dormitory', 22: 'bank', 23: 'warehouse', 29: 'cityhall',
  };
  return map[n] ?? 'unknown';
}

/** 吊车在终局可计为任意建筑;简化:玩家吊车计为其数量最少的建筑类型(最优解由 AI/玩家策略决定,引擎默认给保守解释) */
function craneCountsAs(p: PlayerState, _type: string): boolean {
  void p;
  // 吊车归属是玩家的选择;M2 提供显式选择走子,这里默认 false(未声明不计)。
  return false;
}

/** 收集一名玩家(含自动机卡面)拥有的计分类修道院编号(盾徽6 复制用) */
function collectScoringMonasteries(g: GameState, p: PlayerState): number[] {
  const out: number[] = [];
  for (const t of Object.values(p.placed)) if (t.monastery != null && t.monastery >= 15 && t.monastery <= 26) out.push(t.monastery);
  if (p.automa) {
    for (const card of p.automa.cards) {
      if (!card) continue;
      for (const c of card.cells) {
        if (c.filled?.monastery != null && c.filled.monastery >= 15 && c.filled.monastery <= 26) out.push(c.filled.monastery);
      }
    }
  }
  return out;
}

/** 牲畜计分(放置时):返回应得分;盾徽1:全部牧场视为同一牧场 */
export function livestockScore(g: GameState, player: number, tile: Tile, r: number, c: number): number {
  const p = g.players[player];
  const regs = regionsOf(p.boardId);
  const regionId = regs.regionOf[`${r}:${c}`];
  const same = hasShield(p, 1)
    ? Object.values(p.placed).filter((t) => t !== tile && (t.livestock != null || t.goose === true))
    : regs.regions[regionId].cells
      .map((k) => p.placed[k])
      .filter((t): t is Tile => !!t && t !== tile && (t.livestock != null || t.goose === true));
  let vp = tile.animals ?? 0;
  for (const t of same) {
    if (t.goose) vp += 2;                                   // 鹅:另一物种全部只数?见第二扩展——放置鹅时结算,后续每放牲畜+2
    else if (t.livestock === tile.livestock) vp += t.animals ?? 0;
  }
  // 修道院7:每参与计分的六角片 +1(含新放置)
  if (hasMon(g, p, 7)) vp += 1 + same.filter((t) => t.livestock === tile.livestock || t.goose).length;
  return vp;
}

/** 是否持有 n 号修道院;盾徽6:同时查复制目标的修道院(27 号除外,规则书 p18/27) */
export function hasMon(g: GameState, p: PlayerState, n: number): boolean {
  if (Object.values(p.placed).some((t) => t.monastery === n)) return true;
  if (n !== 27 && p.shields?.includes(6) && p.shieldTarget != null) {
    const t = g.players[p.shieldTarget];
    if (t) {
      if (Object.values(t.placed).some((x) => x.monastery === n)) return true;
      if (t.automa) {
        for (const card of t.automa.cards) {
          if (card?.cells.some((c) => c.filled?.monastery === n)) return true;
        }
      }
    }
  }
  return false;
}
