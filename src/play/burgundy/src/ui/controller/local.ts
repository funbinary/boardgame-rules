// 本地控制器:热座对局的交互状态机(选中骰子/板块 → resolveClick 解析 → 应用)。
// 联机控制器(net.ts)共用同一解析层(click-match),只把 applyMove 换成发招。
import { autopilotPick } from '../../ai/autopilot';
import { applyMove, type MoveError } from '../../engine/moves';
import { createGame } from '../../engine/setup';
import type { GameState, Move } from '../../engine/state';
import { CLICK_SELECTOR, resolveClick } from '../click-match';
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
    const el = (e.target as HTMLElement).closest(CLICK_SELECTOR) as HTMLElement | null;
    if (!el) return;
    try {
      const act = resolveClick(this.state, this.sel, el);
      switch (act.kind) {
        case 'select':
          this.sel = { ...this.sel, ...act.sel };
          this.render();
          break;
        case 'undo':
          this.undo();
          break;
        case 'move':
          this.apply(act.move);
          break;
        case 'noop':
          if (act.flash) this.flash(act.flash);
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.flash(`✗ ${msg}`);
    }
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
