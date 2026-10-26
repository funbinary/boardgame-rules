// 点击 → 行动 的唯一解析层:热座(local.ts)与联机(net.ts)共用,消灭两份手抄 if 链。
// 规则:从点击元素读 data-* 属性,结合当前选择(sel)在 legalMoves 里解析目标走子;
//      解析只依赖 (state, sel, el),不触碰 DOM/网络,可脱离浏览器单测(tests/click-match.test.ts)。
// 新增走子类型只需三处:引擎 legalMoves 产出、views 渲染对应 data 属性、本表加一条解析。
import { actorOf, legalMoves } from '../engine/moves';
import type { GameState, Move } from '../engine/state';
import type { UiSelection } from './views';

/** 控制器委托用的交互元素选择器(热座/联机共用,保证点击面一致) */
export const CLICK_SELECTOR =
  '[data-die],[data-storage],[data-r],[data-depot],[data-cell],[data-moddie],[data-sellcolor],[data-shipdepot],[data-mod],[data-takeshield],[data-takeshieldfree],[data-skipshieldfree],[data-setdie],[data-shield5],[data-shield6],[data-freeplace],[data-skipfreeplace],[data-freeblack],[data-freetwin],[data-vinebonus],[data-vslot],[data-vspace],[data-shopcell],.black-tile,.depot-goods,.goods,[id]';

/** 元素最小结构(HTMLElement 结构性满足;测试用普通对象即可) */
export interface ClickEl {
  id?: string;
  classList: { contains(cls: string): boolean };
  dataset: Record<string, string | undefined>;
}

export type ClickAction =
  | { kind: 'move'; move: Move }
  | { kind: 'select'; sel: Partial<UiSelection> }
  | { kind: 'undo' }
  | { kind: 'noop'; flash?: string };

export function resolveClick(g: GameState, sel: UiSelection, el: ClickEl): ClickAction {
  const moves = legalMoves(g);
  const d = (s: string) => el.dataset[s];
  const pick = (pred: (m: Move) => boolean): Move | null => moves.find(pred) ?? null;
  const move = (m: Move | null): ClickAction => (m ? { kind: 'move', move: m } : { kind: 'noop' });
  const unusedDie = (): 0 | 1 | 'bonus' => {
    const t = g.turn;
    if (!t.used[0]) return 0;
    if (!t.used[1]) return 1;
    return 'bonus';
  };

  // ---- 纯界面动作(选骰/选储存格/旋转/撤销) ----
  if (d('die') != null && el.classList.contains('die')) return { kind: 'select', sel: { die: +d('die')! as 0 | 1 } };
  if (d('storage') != null) return { kind: 'select', sel: { storage: +d('storage')! } };
  if (el.id === 'btn-rot') return { kind: 'select', sel: { rot: sel.rot === 1 ? 0 : 1 } };
  if (el.id === 'btn-undo') return { kind: 'undo' };

  // ---- 面板按钮 ----
  if (el.id === 'btn-workers') return move(pick((mv) => mv.t === 'takeWorkers' && mv.die === (sel.die ?? unusedDie())));
  if (el.id === 'btn-buyinn') return move(pick((mv) => mv.t === 'buyInn'));
  if (d('moddie') != null) {
    const die = +(d('moddie')!) as 0 | 1;
    const delta = +(d('delta')!) as 1 | -1;
    return move(pick((mv) => mv.t === 'modDie' && mv.die === die && mv.delta === delta));
  }
  // ---- 盾徽(P2) ----
  if (d('takeshield') != null) {
    const [depot, idx] = d('takeshield')!.split(':').map(Number);
    return move(pick((mv) => mv.t === 'takeShield' && mv.depot === depot && mv.idx === idx));
  }
  if (d('takeshieldfree') != null) {
    const [depot, idx] = d('takeshieldfree')!.split(':').map(Number);
    return move(pick((mv) => mv.t === 'takeShieldFree' && mv.depot === depot && mv.idx === idx));
  }
  if (d('skipshieldfree') != null) return move(pick((mv) => mv.t === 'skipShieldFree'));
  if (d('setdie') != null) {
    const [die, value] = d('setdie')!.split(':').map(Number);
    return move(pick((mv) => mv.t === 'setDie' && mv.die === die && mv.value === value));
  }
  if (d('shield5') != null) return move(pick((mv) => mv.t === 'answerShield5' && mv.color === +d('shield5')!));
  if (d('shield6') != null) return move(pick((mv) => mv.t === 'answerShield6' && mv.player === +d('shield6')!));
  if (d('freeplace') != null) return move(moves.filter((mv) => mv.t === 'answerFreePlace')[+d('freeplace')!] ?? null);
  if (d('skipfreeplace') != null) return move(pick((mv) => mv.t === 'skipFreePlace'));
  // ---- 葡萄园(P2) ----
  if (d('freeblack') != null) {
    const [source, cell] = d('freeblack')!.split(':');
    return move(pick((mv) => mv.t === 'answerFreeBlack' && mv.source === source && mv.cell === +cell));
  }
  if (d('freetwin') != null) return move(pick((mv) => mv.t === 'answerFreeTwin' && mv.slot === +d('freetwin')!));
  if (d('vinebonus') != null) return move(pick((mv) => mv.t === 'takeVineBonus' && mv.type === d('vinebonus')));
  if (d('vslot') != null) {
    const die = sel.die ?? unusedDie();
    const m = pick((mv) => mv.t === 'takeTwin' && mv.slot === +d('vslot')! && (mv.die === die || mv.die === 'bonus'));
    if (m) return { kind: 'move', move: m };
    const any = pick((mv) => mv.t === 'takeTwin' && mv.slot === +d('vslot')!);
    return any ? { kind: 'noop', flash: '✗ 骰点与槽位不匹配' } : { kind: 'noop' };
  }
  if (d('vspace') != null) {
    const storage = sel.storage ?? g.players[actorOf(g)].storage.findIndex((s) => s?.twin);
    const rot = (+d('vrot')!) as 0 | 1;
    return move(
      pick((mv) => mv.t === 'placeTwin' && mv.space === d('vspace') && mv.rot === rot && mv.storage === storage)
        ?? pick((mv) => mv.t === 'placeTwin' && mv.space === d('vspace') && mv.rot === rot),
    );
  }
  if (d('shopcell') != null) return move(pick((mv) => mv.t === 'buyBlack' && mv.shop === true && mv.cell === +d('shopcell')!));
  if (d('shipdepot') != null) return move(pick((mv) => mv.t === 'answerShipGoods' && mv.depot === +d('shipdepot')!));
  if (d('sellcolor') != null && !el.classList.contains('goods')) {
    return move(pick((mv) => mv.t === 'answerWarehouseSell' && mv.color === +d('sellcolor')!));
  }
  // ---- 公国格放置 ----
  if (d('r') != null && d('c') != null) {
    const r = +d('r')!, c = +d('c')!;
    const top = g.pending[g.pending.length - 1];
    if (top?.kind === 'initialCastle') return move(pick((mv) => mv.t === 'placeCastle' && mv.r === r && mv.c === c));
    if (top?.kind === 'freePlace') return move(pick((mv) => mv.t === 'answerFreePlace' && mv.r === r && mv.c === c));
    if (sel.storage != null) {
      const die = sel.die ?? unusedDie();
      return move(
        pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c && mv.storage === sel.storage && (mv.die === die || mv.die === 'bonus'))
          ?? pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c),
      );
    }
    // bonusAction(cityhall):无需先选储存格(沿用原语义:首个 place 匹配且为 bonus 骰才生效)
    const m = pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c) as Extract<Move, { t: 'place' }> | null;
    if (m && m.die === 'bonus') return { kind: 'move', move: m };
    return { kind: 'noop' };
  }
  // ---- 补给区拿取 / 黑区购买 / 效果拿取 ----
  const depot = d('depot');
  const cell = d('cell');
  if (depot != null && cell != null) {
    const dep = +depot, ce = +cell;
    const answer = pick((mv) => mv.t === 'answerTake' && mv.depot === dep && mv.cell === ce);
    if (answer) return { kind: 'move', move: answer };
    return move(pick((mv) => mv.t === 'take' && mv.depot === dep && mv.cell === ce && (mv.die === (sel.die ?? unusedDie()) || mv.die === 'bonus')));
  }
  if (el.classList.contains('black-tile') && cell != null) {
    return move(pick((mv) => mv.t === 'buyBlack' && mv.cell === +cell!));
  }
  // 船只待决:点补给区货物格
  if (el.classList.contains('depot-goods') && depot != null) {
    return move(pick((mv) => mv.t === 'answerShipGoods' && mv.depot === +depot));
  }
  // 货物出售(骰子行动)
  if (el.classList.contains('goods') && d('sellcolor') != null) {
    return move(pick((mv) => mv.t === 'sell' && mv.die === (sel.die ?? unusedDie())));
  }
  return { kind: 'noop' };
}
