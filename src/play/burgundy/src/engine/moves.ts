// 走子:合法动作枚举与应用。纯函数风格:applyMove 返回新状态(深克隆后改)。
// 任何随机性禁止出现(骰子/布袋都发生在 flow 的固定时机,由 GameState.rng 派生)。
import { loadBoards, vineyardSpaces, vineyardLinkPairs } from './data';
import type { TradeReward } from './data';
import { settle, advanceTrack, gainWorkers, shield5Colors, twinSupplySlots, blackShopOptions, depotShieldOptions, freePlaceMoves, adjacentToPlaced } from './flow';
import { regionsOf, nextTileId } from './setup';
import { callHook } from './modules';
import { hasShield, pickShield, castleCapacity } from './modules/shields';
import { routePlaceGood } from './modules/traderoute';
import { outpostsCheck } from './modules/outposts';
import { executeAutomaTurn } from './modules/automa';
import { resP, storageSlots, setSlot, storageFreeU, fillStorageU, clearStorageU, hasStorageForU } from './modules/team';
import { addVP, livestockScore, hasMon, regionCompleteVP, rewardVP } from './scoring';
import type { GameState, Move, PlayerState, Tile } from './state';
import type { TileColor } from './types';

export class MoveError extends Error {}

const wrap6 = (v: number) => ((v - 1 + 6) % 6) + 1;

export function actorOf(g: GameState): number {
  const top = g.pending[g.pending.length - 1];
  return top ? top.player : g.turn.player;
}

function boardOf(p: PlayerState) {
  const b = loadBoards().boards.find((x) => x.id === p.boardId);
  if (!b) throw new MoveError(`版图 ${p.boardId} 缺失`);
  return b;
}

/** 拿取行动允许的补给区编号(骰点 ± 修道院12) */
function depotNumsFor(g: GameState, p: PlayerState, v: number): number[] {
  const nums = new Set([v]);
  if (hasMon(g, p, 12)) { nums.add(wrap6(v + 1)); nums.add(wrap6(v - 1)); }
  return [...nums];
}

/** 放置行动允许的格点数(骰点 ± 修道院9/10/11,按颜色) */
function cellNumsFor(g: GameState, p: PlayerState, color: TileColor, v: number): number[] {
  const nums = new Set([v]);
  const adj =
    (color === 'brown' && hasMon(g, p, 9)) ||
    ((color === 'blue' || color === 'green') && hasMon(g, p, 10)) ||
    ((color === 'red' || color === 'gray' || color === 'yellow') && hasMon(g, p, 11));
  if (adj) { nums.add(wrap6(v + 1)); nums.add(wrap6(v - 1)); }
  return [...nums];
}

function storageFree(p: PlayerState): boolean { return p.storage.some((s) => s == null) || p.shields?.includes(4) === true; }
void storageFree;

/** 板块入储存格;双生片占 2 格;盾徽4(储存无上限)可扩容 —— 团队模式走统一视图(私2+共2) */
function fillStorage(g: GameState, actor: number, tile: Tile): void {
  const p = resP(g, actor);
  if (!g.teams) {
    const need = tile.twin ? 2 : 1;
    let free = p.storage.filter((s) => s == null).length;
    while (free < need && p.shields?.includes(4)) { p.storage.push(null); free++; }
    if (free < need) throw new MoveError(tile.twin ? '储存格不足 2 格,先弃置' : '储存格已满,先弃置');
    let done = 0;
    for (let i = 0; i < p.storage.length && done < need; i++) {
      if (p.storage[i] == null) { p.storage[i] = tile; done++; }
    }
    return;
  }
  fillStorageU(g, actor, tile);
}

/** 按板块实例 id 清出储存格(双生片清 2 格;团队模式可能跨私人/共享) */
function clearStorage(g: GameState, actor: number, tileId: number): void {
  if (!g.teams) {
    const p = resP(g, actor);
    for (let i = 0; i < p.storage.length; i++) {
      if (p.storage[i]?.id === tileId) p.storage[i] = null;
    }
    return;
  }
  clearStorageU(g, actor, tileId);
}

/** 放置颜色匹配:黑面/旅店可放任意色(骰点/邻接照常) */
function colorMatch(tile: Tile, cellColor: TileColor): boolean {
  return tile.black || tile.inn || tile.color === cellColor;
}

/** 效果链触发深度保护(市政厅→城堡→…极端连锁) */
const MAX_PENDING_DEPTH = 12;

export function applyMove(prev: GameState, move: Move): GameState {
  const g: GameState = structuredClone(prev);
  const actor = actorOf(g);
  const p = resP(g, actor);
  const top = g.pending[g.pending.length - 1];

  // ---- 全局随时可用(自己回合) ----
  if (move.t === 'modDie') {
    requireOwnTurn(g, actor);
    if (g.turn.used[move.die]) throw new MoveError('该骰已使用');
    const step = Math.abs(move.delta);
    if (step !== 1 && !(step === 2 && hasMon(g, p, 8))) throw new MoveError('工人只能 ±1(修道院8:±2)');
    if (p.workers < 1) throw new MoveError('没有工人');
    p.workers -= 1;
    g.turn.dice[move.die] = wrap6(g.turn.dice[move.die] + move.delta);
    g.log.push({ player: actor, text: `工人改骰:${g.turn.dice[move.die]}` });
    return g;
  }
  if (move.t === 'mon28BuyWorkers') {
    requireOwnTurn(g, actor);
    if (!hasMon(g, p, 28)) throw new MoveError('无28号修道院');
    if (p.silver < 1) throw new MoveError('银币不足');
    p.silver -= 1; p.workers += 2;
    g.log.push({ player: actor, text: '28号:1银币→2工人' });
    return g;
  }
  if (move.t === 'mon6Buy') {
    requireOwnTurn(g, actor);
    if (!hasMon(g, p, 6)) throw new MoveError('无6号修道院');
    if (p.mon6Used) throw new MoveError('本回合已用过6号');
    if (p.workers < 2) throw new MoveError('工人不足');
    if (!storageFreeU(g, actor)) throw new MoveError('储存格已满,先弃置');
    if (move.depot < 1 || move.depot > 6) throw new MoveError('黑区不可用');
    const depot = g.depots[move.depot - 1];
    const tile = depot.cells[move.cell];
    if (!tile || tile.color !== 'brown') throw new MoveError('该格无建筑板块');
    depot.cells[move.cell] = null;
    p.workers -= 2;
    p.mon6Used = true;
    fillStorage(g, actor, tile);
    g.log.push({ player: actor, text: `6号修道院:-2工人 拿建筑` });
    return g;
  }
  if (move.t === 'buyBlack') {
    // 黑区购买不是行动,回合内任意时刻可执行(含效果链待决期间);葡萄园下可选购商店双生片
    requireOwnTurn(g, actor);
    if (g.turn.blackBought) throw new MoveError('本回合已购买过黑区');
    if (p.silver < 2) throw new MoveError('银币不足');
    if (move.shop) {
      if (!g.vineyard) throw new MoveError('未启用葡萄园');
      const t = g.vineyard.shopSlots[move.cell];
      if (!t) throw new MoveError('商店该槽无双生片');
      g.vineyard.shopSlots[move.cell] = null;
      p.silver -= 2;
      g.turn.blackBought = true;
      fillStorage(g, actor, t);
      g.log.push({ player: actor, text: `购商店双生片(槽${move.cell + 1},-2银币)` });
      return g;
    }
    if (!storageFreeU(g, actor)) throw new MoveError('储存格已满,先弃置');
    const tile = g.blackDepot[move.cell];
    if (!tile) throw new MoveError('黑区该格无板块');
    g.blackDepot[move.cell] = null;
    p.silver -= 2;
    g.turn.blackBought = true;
    fillStorage(g, actor, tile);
    g.log.push({ player: actor, text: `黑区购买:${tileName(tile)}(-2银币)` });
    return g;
  }
  if (move.t === 'buyInn') {
    // 旅店购买:与黑区购买共用每回合一次(规则书 p14)
    requireOwnTurn(g, actor);
    if (!g.modules.includes('exp6')) throw new MoveError('未启用旅店扩展');
    if (g.turn.blackBought) throw new MoveError('本回合已购买过黑区/旅店');
    if (p.silver < 2) throw new MoveError('银币不足');
    if (g.innPile < 1) throw new MoveError('旅店堆已空');
    const inn: Tile = { id: nextTileId(), color: 'black', black: true, inn: true };
    p.silver -= 2;
    g.innPile -= 1;
    g.turn.blackBought = true;
    fillStorage(g, actor, inn);
    g.log.push({ player: actor, text: `购买旅店(-2银币,余${g.innPile})` });
    return g;
  }
  if (move.t === 'takeShield') {
    // 对子骰拿盾徽:支付两颗同点未用骰,从同号补给区拿 1 盾徽上城堡(规则书 p17)
    requireOwnTurn(g, actor);
    if (!g.modules.includes('shields')) throw new MoveError('未启用盾徽扩展');
    if (!(g.turn.dice[0] === g.turn.dice[1] && !g.turn.used[0] && !g.turn.used[1])) throw new MoveError('需一对未使用的同点骰');
    if (move.depot !== g.turn.dice[0]) throw new MoveError('补给区须与骰点匹配');
    g.turn.used = [true, true];
    pickShield(g, actor, move.depot, move.idx, false, move.replace);
    settle(g);
    return g;
  }
  if (move.t === 'takeShieldFree' || move.t === 'skipShieldFree') {
    // 盾徽11:放置城堡后的免费拿盾徽机会(可放弃)
    requireOwnTurn(g, actor);
    if (!g.turn.shield11Offer) throw new MoveError('没有待结算的盾徽11机会');
    g.turn.shield11Offer = false;
    if (move.t === 'takeShieldFree') pickShield(g, actor, move.depot, move.idx, true, move.replace);
    else g.log.push({ player: actor, text: '盾徽11:放弃免费拿取' });
    settle(g);
    return g;
  }
  if (move.t === 'setDie') {
    // 盾徽18:每回合一次,将一颗未用骰改为任意点(骰仍如常使用)
    requireOwnTurn(g, actor);
    if (!hasShield(p, 18)) throw new MoveError('未持有盾徽18');
    if (g.turn.shield18Used) throw new MoveError('本回合已用过盾徽18');
    if (g.turn.used[move.die]) throw new MoveError('该骰已使用');
    if (move.value < 1 || move.value > 6) throw new MoveError('点数 1-6');
    g.turn.shield18Used = true;
    g.turn.dice[move.die] = move.value;
    g.log.push({ player: actor, text: `盾徽18:骰${move.die + 1} 改为 ${move.value}` });
    return g;
  }
  if (move.t === 'discardStorage') {
    requireOwnTurn(g, actor);
    const slots = storageSlots(g, actor);
    if (slots.some((s) => s == null)) throw new MoveError('储存格未满,无需弃置');
    if (move.slot < 0 || move.slot >= slots.length) throw new MoveError('储存格越界');
    const tile = slots[move.slot];
    if (!tile) throw new MoveError('储存格为空');
    clearStorage(g, actor, tile.id);       // 双生片整片弃置
    g.log.push({ player: actor, text: '弃置储存格板块' });
    return g;
  }
  if (move.t === 'placeCastle') {
    if (!top || top.kind !== 'initialCastle' || top.player !== actor) throw new MoveError('不是你的初始城堡待决');
    const b = boardOf(p);
    const cell = b.cells.find((c) => c.r === move.r && c.c === move.c);
    if (!cell || cell.color !== 'red') throw new MoveError('必须放在暗红格');
    const castle: Tile = { id: 900000 + actor, color: 'red', black: false };
    p.placed[`${move.r}:${move.c}`] = castle;
    p.castleCell = `${move.r}:${move.c}`;
    g.pending.pop();
    g.log.push({ player: actor, text: '放置初始城堡' });
    if (g.pending.length === 0 && g.status === 'placingCastles') g.status = 'playing';
    return g;
  }

  // ---- 待决应答 ----
  if (top && top.player === actor) {
    switch (top.kind) {
      case 'shipGoods': {
        if (move.t !== 'answerShipGoods') throw new MoveError('等待选择船只拿货补给区');
        const depot = g.depots[move.depot - 1];
        if (!depot) throw new MoveError('补给区不存在');
        if (depot.goods) takeGoods(g, actor, depot.n);
        g.pending.pop();
        advanceTrack(g, actor);
        break;
      }
      case 'marketTake': case 'carpenterTake': case 'churchTake': case 'tradeAnyTake': {
        if (move.t !== 'answerTake') throw new MoveError('等待选择拿取目标');
        answerTakeCheck(g, top.kind, move);
        g.pending.pop();
        break;
      }
      case 'warehouseSell': {
        if (move.t !== 'answerWarehouseSell') throw new MoveError('等待选择出售货物颜色');
        if (!(p.goods[move.color]?.length)) throw new MoveError('无该色货物');
        g.pending.pop();
        doSell(g, actor, move.color);
        break;
      }
      case 'shield5Take': {
        // 盾徽5:选一种货物色,从全部补给区拿取该色货物
        if (move.t !== 'answerShield5') throw new MoveError('等待选择货物颜色');
        if (!shield5Colors(g).includes(move.color)) throw new MoveError('该色无货物可取');
        const owned = new Set(Object.keys(p.goods).filter((k) => (p.goods[+k] ?? []).length > 0).map(Number));
        for (const d of g.depots) {
          if (!d.goods || d.goods.color !== move.color) continue;
          if (owned.has(d.goods.color) || owned.size < 3) {
            (p.goods[d.goods.color] ??= []).push(d.goods);
            owned.add(d.goods.color);
            d.goods = undefined;
            g.log.push({ player: actor, text: `盾徽5:获得货物(${move.color}色)` });
          } else {
            g.log.push({ player: actor, text: '盾徽5:货物色超限,留在补给区' });
          }
        }
        g.pending.pop();
        break;
      }
      case 'shield6Target': {
        if (move.t !== 'answerShield6') throw new MoveError('等待选择复制目标玩家');
        if (move.player === actor) throw new MoveError('不能选自己');
        if (move.player < 0 || move.player >= g.playerCount) throw new MoveError('玩家不存在');
        p.shieldTarget = move.player;
        g.log.push({ player: actor, text: `盾徽6:复制 ${g.players[move.player].name} 的修道院` });
        g.pending.pop();
        break;
      }
      case 'freePlace': {
        // 盾徽14/15:阶段末免费放置(骰点不限;颜色/邻接照常)
        if (move.t === 'skipFreePlace') {
          g.pending.pop();
          g.log.push({ player: actor, text: '盾徽14/15:放弃免费放置' });
          break;
        }
        if (move.t !== 'answerFreePlace') throw new MoveError('等待免费放置');
        if (move.from !== top.from) throw new MoveError('来源不符');
        let tile: Tile | null = null;
        if (move.from === 'depot') {
          const dep = g.depots[(move.depot ?? 0) - 1];
          tile = dep?.cells[move.cell] ?? null;
          if (tile) dep!.cells[move.cell] = null;
        } else {
          tile = g.blackDepot[move.cell] ?? null;
          if (tile) g.blackDepot[move.cell] = null;
        }
        if (!tile) throw new MoveError('该格无板块');
        const cell = boardOf(p).cells.find((c) => c.r === move.r && c.c === move.c);
        if (!cell) throw new MoveError('格子不存在');
        if (p.placed[`${move.r}:${move.c}`]) throw new MoveError('格子已被占用');
        if (!colorMatch(tile, cell.color)) throw new MoveError('颜色不匹配');
        if (!adjacentToPlaced(g, actor, move.r, move.c)) throw new MoveError('必须与已放板块相邻');
        g.pending.pop();
        p.placed[`${move.r}:${move.c}`] = tile;
        g.log.push({ player: actor, text: `盾徽14/15 免费放置:${tileName(tile)}→(${move.r},${move.c})` });
        callHook(g, 'onPlace', actor, tile, move.r, move.c);
        resolvePlacement(g, actor, tile, move.r, move.c);
        settle(g);
        return g;
      }
      case 'freeBlackTake': {
        // 双生片奖励:从黑区/商店免费拿 1 个入储存格(不视为购买)
        if (move.t !== 'answerFreeBlack') throw new MoveError('等待选择黑区/商店板块');
        const opt = blackShopOptions(g, actor).find((o) => o.source === move.source && o.cell === move.cell);
        if (!opt) throw new MoveError('该选项不可用');
        if (move.source === 'black') {
          const t = g.blackDepot[move.cell]!;
          g.blackDepot[move.cell] = null;
          fillStorage(g, actor, t);
          g.log.push({ player: actor, text: `双生片奖励:黑区拿取 ${tileName(t)}` });
        } else {
          const t = g.vineyard!.shopSlots[move.cell]!;
          g.vineyard!.shopSlots[move.cell] = null;
          fillStorage(g, actor, t);
          g.log.push({ player: actor, text: '双生片奖励:商店拿取双生片' });
        }
        g.pending.pop();
        break;
      }
      case 'freeTwinTake': {
        if (move.t !== 'answerFreeTwin') throw new MoveError('等待选择双生片槽位');
        const sup = g.vineyard?.supply[move.slot];
        if (!sup?.tile) throw new MoveError('该槽无双生片');
        const t = sup.tile;
        sup.tile = null;
        fillStorage(g, actor, t);
        g.log.push({ player: actor, text: '双生片奖励:补给区拿取双生片' });
        g.pending.pop();
        break;
      }
      case 'vineBonus': {
        if (move.t !== 'takeVineBonus') throw new MoveError('等待选择藤奖励板块');
        const pile = g.vineyard?.bonusPile ?? [];
        const i = pile.indexOf(move.type);
        if (i < 0) throw new MoveError('供应堆无该类型');
        pile.splice(i, 1);
        if (!p.vineyard) p.vineyard = { placed: {}, bonusTiles: [] };
        p.vineyard.bonusTiles.push({ type: move.type });
        g.log.push({ player: actor, text: `葡萄园:领取藤奖励板块(${move.type})` });
        g.pending.pop();
        break;
      }
      case 'bonusAction': {
        // 市政厅/白堡限定:bonus 只能用于 place
        if (top.from === 'cityhall' && !(move.t === 'place' && move.die === 'bonus')) {
          throw new MoveError('市政厅奖励只能放置板块');
        }
        const mdie = 'die' in move ? move.die : undefined;
        if (mdie !== undefined && mdie !== 'bonus') throw new MoveError('待决奖励行动必须使用 bonus');
        g.pending.pop();
        const r = applyAction(g, actor, move);
        settle(r);
        return r;
      }
      case 'initialCastle':
        throw new MoveError('请先放置初始城堡');
      default:
        break;
    }
    settle(g);
    return g;
  }

  // ---- 自动机整回合(官方郡县卡流程) ----
  if (move.t === 'automa') {
    requireOwnTurn(g, actor);
    if (!p.isAutoma) throw new MoveError('只有自动机可执行该走子');
    if (g.status !== 'playing') throw new MoveError('对局未在进行中');
    executeAutomaTurn(g, actor);
    settle(g);
    return g;
  }

  // ---- 常规行动 ----
  if (isAction(move.t)) {
    const r = applyAction(g, actor, move);
    settle(r);
    return r;
  }
  throw new MoveError(`非法走子:${(move as { t: string }).t}`);
}

function isAction(t: string): boolean {
  return t === 'take' || t === 'place' || t === 'sell' || t === 'takeWorkers' ||
    t === 'buyBlack' || t === 'takeTwin' || t === 'placeTwin';
}

function requireOwnTurn(g: GameState, actor: number) {
  if (g.status !== 'playing' && g.status !== 'placingCastles') throw new MoveError('对局未在进行中');
  if (actor !== g.turn.player) throw new MoveError('不是你的回合');
}

/** 行动骰消耗;返回行动用掉的点数 */
function consumeDie(g: GameState, p: PlayerState, move: { die: 0 | 1 | 'bonus'; dieValue?: number }): number {
  if (move.die === 'bonus') {
    if (!g.turn.bonusDice.length) throw new MoveError('没有奖励行动');
    if (move.dieValue == null) throw new MoveError('奖励行动需指定点数');
    g.turn.bonusDice.pop();
    return move.dieValue;
  }
  if (g.turn.used[move.die]) throw new MoveError('该骰已使用');
  g.turn.used[move.die] = true;
  return g.turn.dice[move.die];
}

function applyAction(g: GameState, actor: number, move: Move): GameState {
  const p = resP(g, actor);
  switch (move.t) {
    case 'take': {
      const v = consumeDie(g, p, move);
      if (!storageFreeU(g, actor)) throw new MoveError('储存格已满,先弃置');
      if (!depotNumsFor(g, p, v).includes(move.depot)) throw new MoveError('骰点与补给区不匹配');
      const depot = g.depots[move.depot - 1];
      const tile = depot.cells[move.cell];
      if (!tile) throw new MoveError('该格无板块');
      depot.cells[move.cell] = null;
      fillStorage(g, actor, tile);
      g.log.push({ player: actor, text: `拿取:${tileName(tile)}(补给区${move.depot})` });
      break;
    }
    case 'place': {
      const v = consumeDie(g, p, move);
      const tile = storageSlots(g, actor)[move.storage];
      if (!tile) throw new MoveError('储存格为空');
      const b = boardOf(p);
      const cell = b.cells.find((c) => c.r === move.r && c.c === move.c);
      if (!cell) throw new MoveError('格子不存在');
      if (p.placed[`${move.r}:${move.c}`]) throw new MoveError('格子已被占用');
      if (!colorMatch(tile, cell.color)) throw new MoveError('颜色不匹配');
      if (tile.inn && regionHasInn(g, actor, move.r, move.c)) throw new MoveError('每个区域只能放 1 座旅店');
      if (!cellNumsFor(g, p, tile.color, v).includes(cell.n)) throw new MoveError('骰点与格点不匹配');
      if (!adjacencyOk(g, p, b, move.r, move.c)) throw new MoveError('必须与已放板块相邻');
      clearStorage(g, actor, tile.id);
      p.placed[`${move.r}:${move.c}`] = tile;
      g.log.push({ player: actor, text: `放置:${tileName(tile)}→(${move.r},${move.c})` });
      // 扩展钩子:放置后触发
      callHook(g, 'onPlace', actor, tile, move.r, move.c);
      resolvePlacement(g, actor, tile, move.r, move.c);
      break;
    }
    case 'sell': {
      const v = consumeDie(g, p, move);
      if (!p.goods[v]?.length) throw new MoveError('没有对应颜色的货物');
      doSell(g, actor, v);
      break;
    }
    case 'takeWorkers': {
      consumeDie(g, p, move);
      const n = hasMon(g, p, 14) ? 4 : 2;
      gainWorkers(g, actor, n, '拿取工人');
      if (hasMon(g, p, 13)) p.silver += 1;
      if (hasMon(g, p, 13)) g.log.push({ player: actor, text: '+1银币(修道院13)' });
      break;
    }
    case 'takeTwin': {
      // 葡萄园:骰点匹配补给区槽位,双生片占 2 储存格
      const v = consumeDie(g, p, move);
      if (!g.vineyard) throw new MoveError('未启用葡萄园扩展');
      const sup = g.vineyard.supply[move.slot];
      if (!sup?.tile) throw new MoveError('该槽无双生片');
      if (!sup.ns.includes(v)) throw new MoveError('骰点与槽位不匹配');
      fillStorage(g, actor, sup.tile);
      g.log.push({ player: actor, text: `拿取双生片(槽${move.slot + 1})` });
      sup.tile = null;
      break;
    }
    case 'placeTwin': {
      // 葡萄园:骰点匹配版图空间;首片放底层,之后须相邻;放置后结算 2 奖励行动
      const v = consumeDie(g, p, move);
      const tile = storageSlots(g, actor)[move.storage];
      if (!tile?.twin) throw new MoveError('该储存格无双生片');
      const space = vineyardSpaces().find((s) => s.id === move.space);
      if (!space) throw new MoveError('空间不存在');
      if (!p.vineyard) p.vineyard = { placed: {}, bonusTiles: [] };
      if (p.vineyard.placed[space.id]) throw new MoveError('空间已占用');
      if (space.n !== v) throw new MoveError('骰点与空间不匹配');
      const placedSpaces = Object.keys(p.vineyard.placed);
      if (placedSpaces.length === 0 && space.layer !== 0) throw new MoveError('首个双生片必须放底层');
      if (placedSpaces.length > 0 && !twinAdjacent(g, actor, space.id)) throw new MoveError('必须与已放双生片相邻');
      clearStorage(g, actor, tile.id);
      p.vineyard.placed[space.id] = { tile, rot: move.rot };
      g.log.push({ player: actor, text: `放置双生片→${space.id}(旋转${move.rot === 0 ? '否' : '是'})` });
      // 层完成检查垫底,两奖励行动依序入栈(栈顶先结算)
      pushPending(g, { kind: 'vineCheck', player: actor, space: space.id });
      resolveTwinBonuses(g, actor, tile, space);
      break;
    }
    default:
      throw new MoveError('未知行动');
  }
  return g;
}

/** 双生片空间相邻:任一接触对连通到已放空间 */
function twinAdjacent(g: GameState, player: number, spaceId: string): boolean {
  const placed = Object.keys(g.players[player].vineyard?.placed ?? {});
  return vineyardLinkPairs().some((l) => (l.a === spaceId && placed.includes(l.b)) || (l.b === spaceId && placed.includes(l.a)));
}

/** 双生片放置的两个奖励行动(规则书 p20:奖励印在版图被覆盖格上,官方数据经 space.bonuses 提供;
 *  无版图数据/测试手造片时回退片上 bonus)。结算顺序为固定序 */
function resolveTwinBonuses(g: GameState, actor: number, tile: Tile, space?: { bonuses?: string[] }): void {
  const p = resP(g, actor);
  const actions: string[] = space?.bonuses?.length ? space.bonuses : (tile.twin!.bonus as unknown as string[]);
  for (const b of actions) {
    switch (b) {
      case 'workers2': gainWorkers(g, actor, 2, '双生片'); break;
      case 'workers4': gainWorkers(g, actor, 4, '双生片'); break;
      case 'workers1': gainWorkers(g, actor, 1, '双生片'); break;
      case 'silver2': p.silver += 2; g.log.push({ player: actor, text: '双生片:+2银币' }); break;
      case 'silver1': p.silver += 1; g.log.push({ player: actor, text: '双生片:+1银币' }); break;
      case 'vp4': addVP(g, actor, 4, '双生片'); break;
      case 'vp2': addVP(g, actor, 2, '双生片'); break;
      case 'takeShipLivestock': tryTwinTake(g, actor, ['blue', 'green'], 'marketTake'); break;
      case 'takeBuilding': tryTwinTake(g, actor, ['brown'], 'carpenterTake'); break;
      case 'takeMineMonasteryCastle': tryTwinTake(g, actor, ['red', 'gray', 'yellow'], 'churchTake'); break;
      case 'freeBlack':
        if (blackShopOptions(g, actor).length > 0) pushPending(g, { kind: 'freeBlackTake', player: actor });
        else g.log.push({ player: actor, text: '双生片奖励:黑区/商店无可取,落空' });
        break;
      case 'freeTwin':
        if (twinSupplySlots(g).length > 0 && storageFreeU(g, actor)) pushPending(g, { kind: 'freeTwinTake', player: actor });
        else g.log.push({ player: actor, text: '双生片奖励:补给区无可取,落空' });
        break;
      case 'extraAction':
        g.turn.bonusDice.push(0);
        g.log.push({ player: actor, text: '双生片:获得额外行动' });
        break;
      default: break;
    }
  }
}

function tryTwinTake(g: GameState, actor: number, want: string[], kind: 'marketTake' | 'carpenterTake' | 'churchTake'): void {
  const p = resP(g, actor);
  if (storageFreeU(g, actor) && g.depots.some((d) => d.cells.some((t) => t && want.includes(t.color)))) {
    pushPending(g, { kind, player: actor });
  } else {
    g.log.push({ player: actor, text: '双生片奖励拿取落空' });
  }
}

/** 目标格所在区域是否已有旅店(每区域限 1 座) */
function regionHasInn(g: GameState, player: number, r: number, c: number): boolean {
  const p = g.players[player];
  const regs = regionsOf(p.boardId);
  const region = regs.regions[regs.regionOf[`${r}:${c}`]];
  if (!region) return false;
  return region.cells.some((k) => p.placed[k]?.inn);
}

/** 放置结算:区域完成/奖励板块/各色板块效果/边境哨所 */
function resolvePlacement(g: GameState, actor: number, tile: Tile, r: number, c: number) {
  const p = resP(g, actor);
  const b = boardOf(p);
  // 区域完成(旅店/盾徽16 提升规模)
  const regs = regionsOf(p.boardId);
  const region = regs.regions[regs.regionOf[`${r}:${c}`]];
  if (region.cells.every((k) => p.placed[k])) {
    addVP(g, actor, regionCompleteVP(g, actor, region.cells, region.color), `完成${colorName(region.color)}区域×${region.cells.length}`);
  }
  // 颜色全完成(按格覆盖计:黑面/旅店同样帮助完成)→ 奖励板块
  const cellsOfColor = b.cells.filter((x) => x.color === cellColorOf(b, r, c));
  const covered = cellsOfColor.filter((x) => p.placed[`${x.r}:${x.c}`]).length;
  if (cellsOfColor.length > 0 && covered >= cellsOfColor.length) {
    const claimed = g.rewardClaimed[cellColorOf(b, r, c)] ?? 0;
    const [first, second] = rewardVP(g.playerCount);
    const mul = hasShield(p, 7) ? 2 : 1;
    if (claimed < 2) {
      const vp = (claimed === 0 ? first : second) * mul;
      g.rewardClaimed[cellColorOf(b, r, c)] = claimed + 1;
      p.bonusTiles.push({ color: cellColorOf(b, r, c), value: vp });
      addVP(g, actor, vp, `${colorName(cellColorOf(b, r, c))}色奖励板块${mul > 1 ? '(盾徽7×2)' : ''}`);
    }
  }
  // 边境哨所连通(第四扩展)
  if (g.modules.includes('exp4') && b.cells.some((x) => x.outpost != null)) outpostsCheck(g, actor, b);
  // 板块效果(白色城堡:白骰点数奖励行动;其余按颜色)
  if (tile.whitecastle) {
    g.turn.bonusDice.push(0);
    pushPending(g, { kind: 'bonusAction', player: actor, from: 'whitecastle' });
    g.log.push({ player: actor, text: '白色城堡:获得白骰点数的奖励行动' });
  } else switch (tile.color) {
    case 'blue':   // 船:拿货(待决)+顺位推进(应答后);盾徽5:选色全取
      pushPending(g, { kind: 'shipGoods', player: actor });
      if (hasShield(p, 5)) pushPending(g, { kind: 'shield5Take', player: actor });
      break;
    case 'red':    // 城堡:奖励行动;盾徽11:免费拿盾徽机会
      g.turn.bonusDice.push(0);
      g.log.push({ player: actor, text: '城堡:获得一个额外行动' });
      if (hasShield(p, 11)) {
        if (depotShieldOptions(g).length > 0) g.turn.shield11Offer = true;
        else g.log.push({ player: actor, text: '盾徽11:补给区已无盾徽,落空' });
      }
      break;
    case 'green':  // 牲畜计分
      addVP(g, actor, livestockScore(g, actor, tile, r, c), '牲畜');
      break;
    case 'brown':
      resolveBuilding(g, actor, tile);
      break;
    default:
      break; // 银矿(阶段末)/修道院(持续或终局)
  }
  void p;
}

/** 版图格颜色(放置结算用) */
function cellColorOf(b: { cells: { r: number; c: number; color: TileColor }[] }, r: number, c: number): TileColor {
  return b.cells.find((x) => x.r === r && x.c === c)?.color ?? 'black';
}

function resolveBuilding(g: GameState, actor: number, tile: Tile) {
  const p = resP(g, actor);
  switch (tile.building) {
    case 'market': case 'carpenter': case 'church': {
      const want = tile.building === 'market' ? ['blue', 'green']
        : tile.building === 'carpenter' ? ['brown'] : ['red', 'gray', 'yellow'];
      const any = storageFreeU(g, actor) && g.depots.some((d) => d.cells.some((t) => t && want.includes(t.color)));
      if (any) pushPending(g, { kind: tile.building === 'market' ? 'marketTake' : tile.building === 'carpenter' ? 'carpenterTake' : 'churchTake', player: actor });
      else g.log.push({ player: actor, text: '建筑效果无法结算,落空' });
      break;
    }
    case 'warehouse': {
      if (Object.values(p.goods).some((pile) => pile.length > 0)) pushPending(g, { kind: 'warehouseSell', player: actor });
      else g.log.push({ player: actor, text: '仓库无可售货物,落空' });
      break;
    }
    case 'dormitory': gainWorkers(g, actor, 4, '宿舍'); break;
    case 'bank': p.silver += 2; g.log.push({ player: actor, text: '银行:+2银币' }); break;
    case 'cityhall': {
      if (placeMoves(g, actor, 'bonus', 1).length > 0 || placeMoves(g, actor, 'bonus', 6).length > 0 || placeMoves(g, actor, 'bonus', 3).length > 0) {
        pushPending(g, { kind: 'bonusAction', player: actor, from: 'cityhall' });
        g.turn.bonusDice.push(0);
      } else g.log.push({ player: actor, text: '市政厅无可放置板块,落空' });
      break;
    }
    case 'watchtower': addVP(g, actor, 4, '瞭望塔'); break;
    case 'crane': /* TODO M2b: 吊车选择 */ break;
    default: break;
  }
}

function pushPending(g: GameState, pm: GameState['pending'][number]) {
  if (g.pending.length >= MAX_PENDING_DEPTH) throw new MoveError('效果链过深(异常状态)');
  g.pending.push(pm);
}

function answerTakeCheck(g: GameState, kind: string, move: Extract<Move, { t: 'answerTake' }>) {
  const actor = actorOf(g);
  const p = resP(g, actor);
  if (!storageFreeU(g, actor)) throw new MoveError('储存格已满');
  const depot = g.depots[move.depot - 1];
  if (!depot || move.depot === 0) throw new MoveError('黑区不可用于建筑效果');
  const tile = depot.cells[move.cell];
  if (!tile) throw new MoveError('该格无板块');
  const ok =
    kind === 'tradeAnyTake' ||
    (kind === 'marketTake' && (tile.color === 'blue' || tile.color === 'green')) ||
    (kind === 'carpenterTake' && tile.color === 'brown') ||
    (kind === 'churchTake' && (tile.color === 'red' || tile.color === 'gray' || tile.color === 'yellow'));
  if (!ok) throw new MoveError('板块类型不符');
  depot.cells[move.cell] = null;
  const fi = storageSlots(g, actor).findIndex((s) => s == null);
  if (fi < 0) throw new MoveError('储存格已满');
  setSlot(g, actor, fi, tile);
  g.log.push({ player: actor, text: `建筑效果拿取:${tileName(tile)}` });
}

/** 卖货(骰子行动与仓库共用);返回出售数量。
 *  商路(第八扩展):货物自左而右上商路格,点数匹配 → 立即领奖;填满后进已售堆。
 *  盾徽9:每货物 +1 银;盾徽12:出售分数×2;修道院3/4 照常。 */
function doSell(g: GameState, actor: number, color: number): number {
  const p = resP(g, actor);
  const pile = p.goods[color] ?? [];
  if (!pile.length) return 0;
  const n = pile.length;
  p.goods[color] = [];
  for (const good of pile) {
    const reward = g.modules.includes('exp8') ? routePlaceGood(p, good.value) : null;
    if (reward == null) p.soldGoods.push(good);
    else grantTradeReward(g, actor, reward);
  }
  p.silver += (hasShield(p, 9) ? n : 1) + (hasMon(g, p, 3) ? 1 : 0);
  if (hasMon(g, p, 4)) gainWorkers(g, actor, 1, '修道院4');
  const mul = hasShield(p, 12) ? 2 : 1;
  addVP(g, actor, n * sellEach(g) * mul, `出售${n}货物${mul > 1 ? '(盾徽12×2)' : ''}`);
  return n;
}

/** 商路格奖励发放(占位数据词表见 traderoute.json) */
function grantTradeReward(g: GameState, actor: number, reward: TradeReward): void {
  const p = resP(g, actor);
  switch (reward) {
    case 'workers4': gainWorkers(g, actor, 4, '商路'); break;
    case 'workers2': gainWorkers(g, actor, 2, '商路'); break;
    case 'silver2': p.silver += 2; g.log.push({ player: actor, text: '商路:+2银币' }); break;
    case 'silver1': p.silver += 1; g.log.push({ player: actor, text: '商路:+1银币' }); break;
    case 'vp4': addVP(g, actor, 4, '商路'); break;
    case 'vp2': addVP(g, actor, 2, '商路'); break;
    case 'takeBuilding': tryTradeTake(g, actor, ['brown'], 'carpenterTake'); break;
    case 'takeShipLivestock': tryTradeTake(g, actor, ['blue', 'green'], 'marketTake'); break;
    case 'takeMineMonasteryCastle': tryTradeTake(g, actor, ['red', 'gray', 'yellow'], 'churchTake'); break;
    case 'takeAny': tryTradeTakeAny(g, actor); break;
  }
}

/** 商路 takeAny:从任意非黑补给区任拿 1 块(六色条纹钥匙格,2026-09-23 勘定) */
function tryTradeTakeAny(g: GameState, actor: number): void {
  if (storageFreeU(g, actor) && g.depots.some((d) => d.cells.some((t) => !!t))) {
    pushPending(g, { kind: 'tradeAnyTake', player: actor });
  } else {
    g.log.push({ player: actor, text: '商路 takeAny 落空' });
  }
}

function tryTradeTake(g: GameState, actor: number, want: string[], kind: 'marketTake' | 'carpenterTake' | 'churchTake'): void {
  const p = resP(g, actor);
  if (storageFreeU(g, actor) && g.depots.some((d) => d.cells.some((t) => t && want.includes(t.color)))) {
    pushPending(g, { kind, player: actor });
  } else {
    g.log.push({ player: actor, text: '商路奖励拿取落空' });
  }
}

function sellEach(g: GameState): number { return g.playerCount === 2 ? 2 : g.playerCount; }

function takeGoods(g: GameState, actor: number, depotN: number) {
  const p = resP(g, actor);
  const depot = g.depots[depotN - 1];
  const goods = depot.goods;
  if (!goods) return;
  const colorsOwned = new Set(Object.keys(p.goods).filter((k) => (p.goods[+k] ?? []).length > 0).map(Number));
  if (colorsOwned.has(goods.color) || colorsOwned.size < 3) {
    (p.goods[goods.color] ??= []).push(goods);
    depot.goods = undefined;
    g.log.push({ player: actor, text: `船:获得货物(${goods.color}色)` });
  } else {
    g.log.push({ player: actor, text: '船:货物色超限,留在补给区' });
  }
}

/** 顺位轨推进(实现移至 flow.ts,此处 re-export 兼容) */
export { advanceTrack } from './flow';

function adjacencyOk(g: GameState, p: PlayerState, b: { cells: { r: number; c: number }[] }, r: number, c: number): boolean {
  if (p.shields?.includes(17)) return true;   // 盾徽17:免邻接
  const even = r % 2 === 0;
  const dirs = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  const isFirst = Object.keys(p.placed).length === 1;   // 仅初始城堡
  for (const [dr, dc] of dirs) {
    const k = `${r + dr}:${c + dc}`;
    if (isFirst) {
      if (k === p.castleCell) return true;
    } else if (p.placed[k]) return true;
  }
  if (isFirst) {
    // 城堡邻接兜底(如 castleCell 未记录)
    return !!p.castleCell && b.cells.some((cell) => `${cell.r}:${cell.c}` === p.castleCell)
      ? dirs.some(([dr, dc]) => `${r + dr}:${c + dc}` === p.castleCell) : false;
  }
  return false;
}

function tileName(t: Tile): string {
  if (t.monastery) return `修道院${t.monastery}`;
  if (t.building) return t.building;
  if (t.livestock) return `${t.animals}${t.livestock}`;
  return colorName(t.color);
}

function colorName(c: TileColor): string {
  return ({ yellow: '修道院', blue: '船', red: '城堡', gray: '银矿', green: '牲畜', brown: '建筑', black: '黑' } as Record<string, string>)[c] ?? c;
}

// ================= legalMoves =================

/** 枚举当前行动者全部合法走子(UI 高亮 / AI / 自动机代走共用) */
export function legalMoves(g: GameState): Move[] {
  const out: Move[] = [];
  const actor = actorOf(g);
  const p = resP(g, actor);
  if (g.status === 'ended') return out;

  // 自动机:整回合打包为单走子
  if (p.isAutoma) {
    if (g.status === 'playing' && actor === g.turn.player) out.push({ t: 'automa' });
    return out;
  }

  // 随时类
  if (g.status === 'playing' && actor === g.turn.player) {
    for (const d of [0, 1] as const) {
      if (!g.turn.used[d] && p.workers > 0) {
        out.push({ t: 'modDie', die: d, delta: 1 });
        out.push({ t: 'modDie', die: d, delta: -1 });
        if (hasMon(g, p, 8)) { out.push({ t: 'modDie', die: d, delta: 2 }); out.push({ t: 'modDie', die: d, delta: -2 }); }
      }
      // 盾徽18:每回合一次改骰为任意点
      if (!g.turn.used[d] && hasShield(p, 18) && !g.turn.shield18Used) {
        for (let v = 1; v <= 6; v++) {
          if (v !== g.turn.dice[d]) out.push({ t: 'setDie', die: d, value: v });
        }
      }
    }
    // 盾徽:对子骰拿盾徽
    if (g.modules.includes('shields') && g.turn.dice[0] === g.turn.dice[1] && !g.turn.used[0] && !g.turn.used[1]) {
      const cap = castleCapacity(g, actor);
      const needReplace = (p.shields?.length ?? 0) >= cap;
      g.depots.forEach((dep, di) => {
        if (dep.n !== g.turn.dice[0] || !dep.shields?.length) return;
        dep.shields.forEach((_, si) => {
          if (!needReplace) out.push({ t: 'takeShield', depot: di + 1, idx: si });
          else p.shields!.forEach((_, ri) => out.push({ t: 'takeShield', depot: di + 1, idx: si, replace: ri }));
        });
      });
    }
    // 盾徽11:免费拿盾徽(可放弃)
    if (g.turn.shield11Offer) {
      const cap = castleCapacity(g, actor);
      const needReplace = (p.shields?.length ?? 0) >= cap;
      for (const { depot, idx } of depotShieldOptions(g)) {
        if (!needReplace) out.push({ t: 'takeShieldFree', depot, idx });
        else p.shields!.forEach((_, ri) => out.push({ t: 'takeShieldFree', depot, idx, replace: ri }));
      }
      out.push({ t: 'skipShieldFree' });
    }
    if (hasMon(g, p, 28) && p.silver >= 1) out.push({ t: 'mon28BuyWorkers' });
    if (hasMon(g, p, 6) && !p.mon6Used && p.workers >= 2 && storageFreeU(g, actor)) {
      g.depots.forEach((dep, di) => dep.cells.forEach((t, ci) => {
        if (t && t.color === 'brown') out.push({ t: 'mon6Buy', depot: di + 1, cell: ci });
      }));
    }
    const slots = storageSlots(g, actor);
    if (slots.some((s) => s != null) && slots.every((s) => s != null)) {
      slots.forEach((s, i) => { if (s != null) out.push({ t: 'discardStorage', slot: i }); });
    }
    // 黑区购买 / 商店双生片购买 / 旅店购买(共用每回合一次;黑面/旅店占1格,双生片占2格)
    if (!g.turn.blackBought && p.silver >= 2) {
      if (hasStorageFor(g, actor, 1)) {
        g.blackDepot.forEach((t, i) => { if (t) out.push({ t: 'buyBlack', cell: i }); });
        if (g.modules.includes('exp6') && g.innPile > 0) out.push({ t: 'buyInn' });
      }
      if (g.vineyard && hasStorageFor(g, actor, 2)) {
        g.vineyard.shopSlots.forEach((t, i) => { if (t) out.push({ t: 'buyBlack', cell: i, shop: true }); });
      }
    }
  }

  // 初始城堡
  const top = g.pending[g.pending.length - 1];
  if (top?.kind === 'initialCastle' && top.player === actor) {
    for (const c of boardOf(p).cells) {
      if (c.color === 'red' && !p.placed[`${c.r}:${c.c}`]) out.push({ t: 'placeCastle', r: c.r, c: c.c });
    }
    return out;
  }

  if (g.status !== 'playing') return out;

  // 待决应答
  if (top && top.player === actor) {
    switch (top.kind) {
      case 'shipGoods':
        for (let d = 1; d <= 6; d++) out.push({ t: 'answerShipGoods', depot: d });
        return out;
      case 'marketTake': case 'carpenterTake': case 'churchTake': case 'tradeAnyTake': {
        if (storageFreeU(g, actor)) {
          const want = top.kind === 'marketTake' ? ['blue', 'green']
            : top.kind === 'carpenterTake' ? ['brown']
            : top.kind === 'tradeAnyTake' ? ['yellow', 'blue', 'red', 'gray', 'green', 'brown']
            : ['red', 'gray', 'yellow'];
          g.depots.forEach((dep, di) => dep.cells.forEach((t, ci) => {
            if (t && want.includes(t.color)) out.push({ t: 'answerTake', depot: di + 1, cell: ci });
          }));
        }
        return out;
      }
      case 'warehouseSell': {
        for (const k of Object.keys(p.goods)) {
          const color = +k;
          if ((p.goods[color] ?? []).length > 0) out.push({ t: 'answerWarehouseSell', color });
        }
        return out;
      }
      case 'shield5Take':
        for (const color of shield5Colors(g)) out.push({ t: 'answerShield5', color });
        return out;
      case 'shield6Target':
        for (const pl of g.players) {
          if (pl.idx !== actor) out.push({ t: 'answerShield6', player: pl.idx });
        }
        return out;
      case 'freePlace': {
        for (const m of freePlaceMoves(g, actor, top.from)) {
          out.push({ t: 'answerFreePlace', from: m.from, depot: m.depot, cell: m.cell, r: m.r, c: m.c });
        }
        out.push({ t: 'skipFreePlace' });
        return out;
      }
      case 'freeBlackTake':
        for (const o of blackShopOptions(g, actor)) {
          out.push({ t: 'answerFreeBlack', source: o.source, cell: o.cell });
        }
        return out;
      case 'freeTwinTake':
        for (const i of twinSupplySlots(g)) out.push({ t: 'answerFreeTwin', slot: i });
        return out;
      case 'vineBonus':
        if (g.vineyard) {
          for (const type of [...new Set(g.vineyard.bonusPile)]) out.push({ t: 'takeVineBonus', type });
        }
        return out;
      case 'bonusAction': {
        if (top.from === 'cityhall') {
          const seen = new Set<string>();
          for (let v = 1; v <= 6; v++) {
            for (const m of placeMoves(g, actor, 'bonus', v)) {
              const pm = m as Extract<Move, { t: 'place' }>;
              const key = `${pm.storage}:${pm.r}:${pm.c}`;
              if (!seen.has(key)) { seen.add(key); out.push(m); }
            }
          }
          return out;
        }
        // 白色城堡:用白骰点数执行一个行动(拿取/放置/出售/工人)
        if (top.from === 'whitecastle') {
          const v = g.whiteDie;
          if (storageFreeU(g, actor)) {
            for (const n of depotNumsFor(g, p, v)) {
              const dep = g.depots[n - 1];
              if (!dep) continue;
              dep.cells.forEach((t, ci) => { if (t) out.push({ t: 'take', die: 'bonus', depot: n, cell: ci, dieValue: v }); });
            }
          }
          for (const m of placeMoves(g, actor, 'bonus', v)) out.push(m);
          if (p.goods[v]?.length) out.push({ t: 'sell', die: 'bonus', dieValue: v });
          out.push({ t: 'takeWorkers', die: 'bonus', dieValue: v });
        }
        return out;
      }
      default: return out;
    }
  }

  if (actor !== g.turn.player) return out;

  // 常规行动
  const dice: { die: 0 | 1 | 'bonus'; v: number }[] = [];
  if (!g.turn.used[0]) dice.push({ die: 0, v: g.turn.dice[0] });
  if (!g.turn.used[1]) dice.push({ die: 1, v: g.turn.dice[1] });
  for (const b of g.turn.bonusDice) {
    for (let v = 1; v <= 6; v++) dice.push({ die: 'bonus', v });
  }

  for (const { die, v } of dice) {
    // 拿取
    if (storageFreeU(g, actor)) {
      for (const n of depotNumsFor(g, p, v)) {
        const dep = g.depots[n - 1];
        if (!dep) continue;
        dep.cells.forEach((t, ci) => { if (t) out.push({ t: 'take', die, depot: n, cell: ci, dieValue: die === 'bonus' ? v : undefined }); });
      }
    }
    // 放置
    for (const m of placeMoves(g, actor, die, die === 'bonus' ? v : undefined)) out.push(m);
    // 卖货
    if (p.goods[v]?.length) out.push({ t: 'sell', die, dieValue: die === 'bonus' ? v : undefined });
    // 工人
    out.push({ t: 'takeWorkers', die });
    // 葡萄园:拿取双生片(占 2 储存格)
    if (g.vineyard && hasStorageFor(g, actor, 2)) {
      g.vineyard.supply.forEach((s, i) => {
        if (s.tile && s.ns.includes(v)) out.push({ t: 'takeTwin', die, slot: i, dieValue: die === 'bonus' ? v : undefined });
      });
    }
  }
  // 葡萄园:放置双生片(骰点匹配空间;储存格中同 id 双生片任取一格)
  if (g.vineyard) {
    const seenTwin = new Set<number>();
    storageSlots(g, actor).forEach((tile, si) => {
      if (!tile?.twin || seenTwin.has(tile.id)) return;
      seenTwin.add(tile.id);
      for (const space of vineyardSpaces()) {
        if (p.vineyard?.placed[space.id]) continue;
        const placedSpaces = Object.keys(p.vineyard?.placed ?? {});
        if (placedSpaces.length === 0 && space.layer !== 0) continue;
        if (placedSpaces.length > 0 && !twinAdjacent(g, actor, space.id)) continue;
        for (const { die, v } of dice) {
          if (space.n === v) {
            out.push({ t: 'placeTwin', die, storage: si, space: space.id, rot: 0, dieValue: die === 'bonus' ? v : undefined });
            out.push({ t: 'placeTwin', die, storage: si, space: space.id, rot: 1, dieValue: die === 'bonus' ? v : undefined });
          }
        }
      }
    });
  }
  return out;
}

/** 是否有 n 格储存空间(团队=私人2+共享2;盾徽4 视为可扩容) */
function hasStorageFor(g: GameState, actor: number, n: number): boolean {
  return hasStorageForU(g, actor, n);
}

function placeMoves(g: GameState, actor: number, die: 0 | 1 | 'bonus', dieValue?: number): Move[] {
  const out: Move[] = [];
  const p = resP(g, actor);
  const b = boardOf(p);
  storageSlots(g, actor).forEach((tile, si) => {
    if (!tile) return;
    for (const cell of b.cells) {
      if (p.placed[`${cell.r}:${cell.c}`]) continue;
      if (!colorMatch(tile, cell.color)) continue;
      if (tile.inn && regionHasInn(g, actor, cell.r, cell.c)) continue;
      const v = die === 'bonus' ? dieValue! : g.turn.dice[die];
      if (!cellNumsFor(g, p, tile.color, v).includes(cell.n)) continue;
      if (!adjacencyOk(g, p, b, cell.r, cell.c)) continue;
      out.push({ t: 'place', die, storage: si, r: cell.r, c: cell.c, dieValue: die === 'bonus' ? v : undefined });
    }
  });
  return out;
}
