// 本地控制器:热座对局的交互状态机(选中骰子/板块 → 匹配合法走子 → 应用)。
// 联机控制器(M5)复用同一套匹配逻辑,只把 applyMove 换成发招+本地预测。
import { autopilotPick } from '../../ai/autopilot';
import { applyMove, legalMoves, type MoveError } from '../../engine/moves';
import { createGame } from '../../engine/setup';
import type { GameState, Move } from '../../engine/state';
import { renderGame, type UiSelection } from '../views';

export interface LocalGameOpts {
  seed?: number;
  playerCount: number;
  names?: string[];
  modules?: string[];
  /** 自动机配置(难度/修正);含自动机模块时生效 */
  automa?: { difficulty: 'easy' | 'normal' | 'hard'; modifiers: string[] };
}

export class LocalGame {
  state: GameState;
  history: GameState[] = [];
  sel: UiSelection = { die: null, storage: null };
  private root: HTMLElement;

  constructor(root: HTMLElement, opts: LocalGameOpts) {
    this.root = root;
    this.state = createGame({
      seed: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
      playerCount: opts.playerCount,
      names: opts.names,
      modules: opts.modules as GameState['modules'],
      automa: opts.automa,
    });
    this.render();
    root.addEventListener('click', (e) => this.onClick(e));
  }

  render() {
    // 自动选骰:仅一颗未用且无 bonus 时
    const t = this.state.turn;
    if (this.sel.die != null && t.used[this.sel.die]) this.sel.die = t.used[0] ? 1 : 0;
    if (this.sel.die != null && t.used[this.sel.die]) this.sel.die = null;
    if (this.sel.die == null && !t.used[0] && t.used[1]) this.sel.die = 0;
    if (this.sel.die == null && t.used[0] && !t.used[1]) this.sel.die = 1;
    this.root.innerHTML = renderGame(this.state, this.sel);
  }

  private apply(m: Move) {
    this.history.push(this.state);
    if (this.history.length > 50) this.history.shift();
    this.state = applyMove(this.state, m);
    this.sel = { die: this.sel.die, storage: null };
    // 自动机回合:整回合打包为单走子,经引擎执行(可重放)
    if (this.state.status === 'playing' || this.state.status === 'placingCastles') {
      const automaIdx = this.state.players.findIndex((p) => p.isAutoma);
      if (automaIdx >= 0) {
        const actor = this.state.pending.length
          ? this.state.pending[this.state.pending.length - 1].player
          : this.state.turn.player;
        if (actor === automaIdx && this.state.status === 'playing') {
          this.state = applyMove(this.state, { t: 'automa' });
        }
      }
    }
    this.render();
  }

  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest('[data-die],[data-storage],[data-r],[data-depot],[data-cell],[data-moddie],[data-sellcolor],[data-shipdepot],[data-mod],[id]');
    if (!el) return;
    const d = (s: string) => (el as HTMLElement).dataset[s];
    try {
      // ---- 按钮 ----
      if (el.id === 'btn-workers') {
        const die = this.sel.die ?? this.unusedDie();
        const m = this.pick((mv) => mv.t === 'takeWorkers' && mv.die === die);
        if (m) this.apply(m);
        return;
      }
      if (el.id === 'btn-undo') { this.undo(); return; }
      if (d('moddie') != null) {
        const die = +(d('moddie')!) as 0 | 1;
        const delta = +(d('delta')!) as 1 | -1;
        const m = this.pick((mv) => mv.t === 'modDie' && mv.die === die && mv.delta === delta);
        if (m) this.apply(m);
        return;
      }
      if (d('shipdepot') != null) {
        const depot = +d('shipdepot')!;
        const m = this.pick((mv) => mv.t === 'answerShipGoods' && mv.depot === depot);
        if (m) this.apply(m);
        return;
      }
      if (d('sellcolor') != null && !el.classList.contains('goods')) {
        const color = +d('sellcolor')!;
        const m = this.pick((mv) => mv.t === 'answerWarehouseSell' && mv.color === color);
        if (m) this.apply(m);
        return;
      }
      // ---- 骰子选择 ----
      if (d('die') != null && el.classList.contains('die')) {
        this.sel.die = +d('die')! as 0 | 1;
        this.render();
        return;
      }
      // ---- 储存格选择 ----
      if (d('storage') != null) {
        this.sel.storage = +d('storage')!;
        this.render();
        return;
      }
      // ---- 公国格放置 ----
      if (d('r') != null && d('c') != null) {
        const r = +d('r')!, c = +d('c')!;
        const top = this.state.pending[this.state.pending.length - 1];
        if (top?.kind === 'initialCastle') {
          const m = this.pick((mv) => mv.t === 'placeCastle' && mv.r === r && mv.c === c);
          if (m) this.apply(m);
          return;
        }
        if (this.sel.storage != null) {
          const die = this.sel.die ?? this.unusedDie();
          const m = this.pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c && mv.storage === this.sel.storage && (mv.die === die || mv.die === 'bonus'));
          if (m) this.apply(m);
          else {
            const any = this.pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c);
            if (any) this.apply(any);
          }
          return;
        }
        // bonusAction(cityhall):无需先选储存格
        const m = this.pick((mv) => mv.t === 'place' && mv.r === r && mv.c === c) as Extract<Move, { t: 'place' }> | null;
        if (m && m.die === 'bonus') this.apply(m);
        return;
      }
      // ---- 补给区拿取 / 黑区购买 / 效果拿取 ----
      const depot = d('depot');
      const cell = d('cell');
      if (depot != null && cell != null) {
        const dep = +depot, ce = +cell;
        // 待决 answerTake 优先
        const answer = this.pick((mv) => mv.t === 'answerTake' && mv.depot === dep && mv.cell === ce);
        if (answer) { this.apply(answer); return; }
        const die = this.sel.die ?? this.unusedDie();
        const m = this.pick((mv) => mv.t === 'take' && mv.depot === dep && mv.cell === ce && (mv.die === die || mv.die === 'bonus'));
        if (m) this.apply(m);
        return;
      }
      if (el.classList.contains('black-tile') && cell != null) {
        const m = this.pick((mv) => mv.t === 'buyBlack' && mv.cell === +cell!);
        if (m) this.apply(m);
        return;
      }
      // 船只待决:点补给区货物格
      if (el.classList.contains('depot-goods') && depot != null) {
        const m = this.pick((mv) => mv.t === 'answerShipGoods' && mv.depot === +depot);
        if (m) this.apply(m);
        return;
      }
      // 货物出售(骰子行动)
      if (el.classList.contains('goods') && d('sellcolor') != null) {
        const die = this.sel.die ?? this.unusedDie();
        const m = this.pick((mv) => mv.t === 'sell' && mv.die === die);
        if (m) this.apply(m);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.flash(`✗ ${msg}`);
    }
  }

  /** 货物出售的待决提示里也直接显示颜色块 */
  private unusedDie(): 0 | 1 | 'bonus' {
    const t = this.state.turn;
    if (!t.used[0]) return 0;
    if (!t.used[1]) return 1;
    return 'bonus';
  }

  private pick(pred: (m: Move) => boolean): Move | null {
    return legalMoves(this.state).find(pred) ?? null;
  }

  undo() {
    const prev = this.history.pop();
    if (prev) { this.state = prev; this.render(); }
  }

  /** 代走一手(调试/演示) */
  hint() {
    const m = autopilotPick(this.state);
    if (m) this.apply(m);
  }

  private flash(text: string) {
    const bar = document.createElement('div');
    bar.className = 'flash';
    bar.textContent = text;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 1800);
  }
}

export type { MoveError };
