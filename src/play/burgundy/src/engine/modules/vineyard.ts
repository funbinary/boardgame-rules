// 葡萄园扩展(P2):双生六角片真实玩家侧。机制(规则书 p19-21):
//  - 每阶段开始:清空补给区+商店(弃置),从布袋抽片补满(4p:补给6+商店3;3p:补给3+商店3;2p:补给3+商店1)。
//  - 行动「拿取双生片」:骰点匹配补给区槽位(2-3人每片两个点数),占 2 个储存格。
//  - 行动「放置双生片」:骰点匹配版图空间;首片须放底层(0层),之后须与已放片相邻;可旋转。
//    放置后结算两个奖励行动;若覆盖同一层全部空间 → 领 1 个藤奖励板块。
//  - 商店:黑区购买时可改购商店双生片(同 2 银/每回合一次)。
//  - 终局:每个藤奖励板块对一个同藤色连通区域计分;每区域只计一次。
// 数据(版图布局/双生片配比/槽位点数)为占位(vineyard.json _meta)。
import type { GameState, PlayerState, Tile, VineBonus, VineColor } from '../state';
import type { ModuleHook } from '../modules';
import { loadVineyardData, vineyardLinkPairs, vineyardSpaces } from '../data';
import { randInt, type RngState } from '../rng';
import { nextTileId } from '../setup';

const VINES: VineColor[] = ['red', 'white', 'yellow', 'green', 'blue', 'purple'];
const BONUSES: VineBonus[] = [
  'workers2', 'silver2', 'workers1', 'silver1', 'vp4', 'vp2',
  'takeShipLivestock', 'takeBuilding', 'takeMineMonasteryCastle',
  'freeBlack', 'freeTwin', 'extraAction',
];

/** 布袋双生片(官方构成:6 纯色各1 + 15 混色各3 = 51;片上 bonus 为引擎兜底,官方奖励印在版图格) */
function makeBag(g: GameState): Tile[] {
  let r = g.rng;
  const bag: Tile[] = [];
  const comp = loadVineyardData().bagComposition;
  if (comp?.pureColors?.length) {
    const colors = comp.pureColors;
    const pairs: [VineColor, VineColor][] = [];
    for (const c of colors) pairs.push([c as VineColor, c as VineColor]);
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        for (let k = 0; k < (comp.mixedEach ?? 3); k++) pairs.push([colors[i] as VineColor, colors[j] as VineColor]);
      }
    }
    const fallbackBonus = (comp.bonus ?? ['vp2', 'silver1']) as [VineBonus, VineBonus];
    for (const vines of pairs) {
      bag.push({ id: nextTileId(), color: 'green', black: false, twin: { vines, bonus: fallbackBonus } });
    }
    g.rng = r;
    return bag;
  }
  for (let i = 0; i < loadVineyardData().bagCount; i++) {
    const [a, r1] = randInt(r, VINES.length);
    const [b, r2] = randInt(r1, VINES.length);
    const [x, r3] = randInt(r2, BONUSES.length);
    const [y, r4] = randInt(r3, BONUSES.length);
    r = r4;
    bag.push({ id: nextTileId(), color: 'green', black: false, twin: { vines: [VINES[a], VINES[b]], bonus: [BONUSES[x], BONUSES[y]] } });
  }
  g.rng = r;
  return bag;
}

/** 每阶段开始补充葡萄园补给区+商店(先清空弃置);beginPhase 调用 */
export function refillVineyard(g: GameState): void {
  if (!g.vineyard) return;
  const d = loadVineyardData();
  const key = `p${g.playerCount}` as 'p2' | 'p3' | 'p4';
  const nums = d.supplyNums[key];
  let r = g.rng;
  const draw = (): [Tile | null, RngState] => {
    if (!g.vineyard!.bag.length) return [null, r];
    const [k, nr] = randInt(r, g.vineyard!.bag.length);
    r = nr;
    return [g.vineyard!.bag.splice(k, 1)[0] ?? null, r];
  };
  if (g.round === 1) {
    // 每阶段开始(即轮次1):先清空补给区+商店(放回盒中,不再使用)
    g.vineyard.supply = [];
    g.vineyard.shopSlots = [];
  }
  g.vineyard.supply = nums.map((ns) => {
    const [tile] = draw();
    return { ns, tile };
  });
  g.vineyard.shopSlots = Array.from({ length: d.shopSlots[key] }, () => null);
  for (let i = 0; i < g.vineyard.shopSlots.length; i++) {
    const [tile] = draw();
    g.vineyard.shopSlots[i] = tile;
  }
  g.rng = r;
}

export const vineyardModule: ModuleHook = {
  onSetup(g) {
    const d = loadVineyardData();
    g.vineyard = { bag: makeBag(g), supply: [], shopSlots: [], bonusPile: [] };
    // 藤奖励板块供应堆:6 种 × 4;先取 6 种各 1 洗混给每人 1 个(规则书 p19)
    const pile: string[] = [];
    for (const t of d.bonusTypes) for (let i = 0; i < d.bonusPerType; i++) pile.push(t);
    let r = g.rng;
    const pool = [...pile];
    for (let i = pool.length - 1; i > 0; i--) {
      const [j, nr] = randInt(r, i + 1);
      r = nr;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // 6 种各 1:从洗混后的堆中按类型去重取前 6 个
    const seen = new Set<string>();
    const start: string[] = [];
    for (const t of pool) {
      if (seen.size >= d.bonusTypes.length) break;
      if (!seen.has(t)) { seen.add(t); start.push(t); }
    }
    for (const p of g.players) {
      if (p.isAutoma) continue;   // 自动机不用藤奖励板块(规则书 p27)
      const t = start[p.idx % start.length];
      p.vineyard = { placed: {}, bonusTiles: [{ type: t }] };
    }
    // 供应堆 = 洗混堆移除已发的 6 个
    const remaining = [...pool];
    for (const t of start) {
      const i = remaining.indexOf(t);
      if (i >= 0) remaining.splice(i, 1);
    }
    g.rng = r;
    g.vineyard.bonusPile = remaining;
      g.log.push({ text: `葡萄园:真实玩家各起始 1 个藤奖励板块(自动机不用,p27),供应堆余 ${remaining.length};布袋 ${g.vineyard.bag.length} 双生片` });
    // 阶段A补充在 createGame→beginPhase→refillVineyard 进行
  },
  onEndgame(g, player) {
    // 只返回分值(addVP 由 endgameScore 统一入明细,避免双计)
    return vineyardEndgameVP(g, player);
  },
};

const VINE_SCORES = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91];

/** 放置双生片后:vines 在两格上的落色(rot=1 交换) */
export function twinVinesAt(tile: Tile, rot: 0 | 1): [VineColor, VineColor] {
  const t = tile.twin!;
  return rot === 0 ? [t.vines[0], t.vines[1]] : [t.vines[1], t.vines[0]];
}

/** 葡萄园连通藤色区域:返回各藤色区域规模列表(降序) */
export function vineyardRegions(g: GameState, player: number): Record<string, number[]> {
  const p = g.players[player];
  const spaces = vineyardSpaces();
  const links = vineyardLinkPairs();
  // hex 状态:key = `${spaceId}:${hexIdx}` → vine
  const vineAt = new Map<string, VineColor>();
  for (const [sid, rec] of Object.entries(p.vineyard?.placed ?? {})) {
    const vines = twinVinesAt(rec.tile, rec.rot);
    vineAt.set(`${sid}:0`, vines[0]);
    vineAt.set(`${sid}:1`, vines[1]);
  }
  // hex 邻接(接触对,按藤色相同合并)
  const adj = new Map<string, string[]>();
  for (const l of links) {
    for (const [ah, bh] of [[l.ah, l.bh]] as const) {
      const ka = `${l.a}:${ah}`, kb = `${l.b}:${bh}`;
      if (!adj.has(ka)) adj.set(ka, []);
      if (!adj.has(kb)) adj.set(kb, []);
      adj.get(ka)!.push(kb);
      adj.get(kb)!.push(ka);
    }
  }
  // 同片两格恒相邻
  for (const s of spaces) {
    const ka = `${s.id}:0`, kb = `${s.id}:1`;
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    if (!adj.get(ka)!.includes(kb)) { adj.get(ka)!.push(kb); adj.get(kb)!.push(ka); }
  }
  // 连通分量(同藤色)
  const out: Record<string, number[]> = {};
  const visited = new Set<string>();
  for (const [key, vine] of vineAt) {
    if (visited.has(key)) continue;
    let size = 0;
    const stack = [key];
    visited.add(key);
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb) && vineAt.get(nb) === vine) { visited.add(nb); stack.push(nb); }
      }
    }
    (out[vine] ??= []).push(size);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b - a);
  return out;
}

/** 葡萄园终局计分:每个藤奖励板块对一个同藤色区域计分,区域不重复使用(取最优分配:每类取前 k 大) */
export function vineyardEndgameVP(g: GameState, player: number): number {
  const p = g.players[player];
  if (!p.vineyard) return 0;
  const regions = vineyardRegions(g, player);
  const byType: Record<string, number> = {};
  for (const b of p.vineyard.bonusTiles) byType[b.type] = (byType[b.type] ?? 0) + 1;
  let vp = 0;
  const used = new Set<string>();
  for (const [type, count] of Object.entries(byType)) {
    const sizes = regions[type] ?? [];
    let taken = 0;
    for (const size of sizes) {
      if (taken >= count) break;
      const key = `${type}:${size}`;
      vp += VINE_SCORES[Math.min(size, 13) - 1] ?? 91;
      used.add(key);
      taken++;
    }
  }
  return vp;
}

/** 层完成检查:该空间所在层的全部空间是否都已放置(是则返回层号,否则 null) */
export function completedLayer(g: GameState, player: number, spaceId: string): number | null {
  const p = g.players[player];
  const spaces = vineyardSpaces();
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) return null;
  const layerSpaces = spaces.filter((s) => s.layer === space.layer);
  return layerSpaces.every((s) => p.vineyard?.placed[s.id]) ? space.layer : null;
}
