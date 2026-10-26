// click-match 单测:热座/联机共用的点击解析层(纯逻辑,不经 DOM)。
// 这里钉住解析语义——此前 local.ts 与 net.ts 各手抄一份并已漂移(vslot 提示/vspace 储存格回退)。
import { describe, expect, it } from 'vitest';
import { autopilotPick } from '../src/ai/autopilot';
import { applyMove, legalMoves } from '../src/engine/moves';
import { createGame } from '../src/engine/setup';
import type { GameState, Move } from '../src/engine/state';
import { resolveClick, type ClickEl } from '../src/ui/click-match';

const el = (dataset: Record<string, string | undefined>, id?: string, classes: string[] = []): ClickEl => ({
  id,
  classList: { contains: (c: string) => classes.includes(c) },
  dataset,
});

/** 推进过初始城堡布置、进入常规回合的局面 */
function pastSetup(seed: number): GameState {
  let g = createGame({ seed, playerCount: 2 });
  for (let i = 0; i < 60; i++) {
    const ms = legalMoves(g);
    if (ms.some((m) => m.t === 'take') && ms.some((m) => m.t === 'takeWorkers')) return g;
    g = applyMove(g, autopilotPick(g)!);
  }
  throw new Error('60 步内未进入常规回合');
}

describe('resolveClick(统一点击解析)', () => {
  it('纯界面动作:选骰/选储存格/旋转/撤销(与走子无关,开局即可)', () => {
    const g = createGame({ seed: 1, playerCount: 2 });
    expect(resolveClick(g, { die: null, storage: null }, el({ die: '1' }, undefined, ['die']))).toEqual({ kind: 'select', sel: { die: 1 } });
    expect(resolveClick(g, { die: null, storage: null }, el({ storage: '3' }))).toEqual({ kind: 'select', sel: { storage: 3 } });
    expect(resolveClick(g, { die: null, storage: null, rot: 0 }, el({}, 'btn-rot'))).toEqual({ kind: 'select', sel: { rot: 1 } });
    expect(resolveClick(g, { die: null, storage: null }, el({}, 'btn-undo'))).toEqual({ kind: 'undo' });
  });

  it('按钮走子:拿工人取当前选择骰,未选则首个未用骰', () => {
    const g = pastSetup(1);
    expect(resolveClick(g, { die: null, storage: null }, el({}, 'btn-workers')))
      .toMatchObject({ kind: 'move', move: { t: 'takeWorkers' } });
    const die = (legalMoves(g).find((m) => m.t === 'takeWorkers') as { die: 0 | 1 }).die;
    expect(resolveClick(g, { die, storage: null }, el({}, 'btn-workers')))
      .toMatchObject({ kind: 'move', move: { t: 'takeWorkers', die } });
  });

  it('补给区拿取:depot/cell + 骰子解析', () => {
    const g = pastSetup(1);
    const take = legalMoves(g).find((m) => m.t === 'take') as Extract<Move, { t: 'take' }>;
    expect(resolveClick(g, { die: null, storage: null }, el({ depot: String(take.depot), cell: String(take.cell) })))
      .toMatchObject({ kind: 'move', move: { t: 'take', depot: take.depot, cell: take.cell, die: take.die } });
    // 选了对应骰后解析到同一走子
    if (take.die !== 'bonus') {
      expect(resolveClick(g, { die: take.die, storage: null }, el({ depot: String(take.depot), cell: String(take.cell) })))
        .toMatchObject({ kind: 'move', move: { t: 'take', die: take.die } });
    }
  });

  it('待决索引与无效分支安全回落 noop', () => {
    const g = createGame({ seed: 1, playerCount: 2 });
    // 无待决时 freeplace 索引与仓库出售按钮均无走子可配
    expect(resolveClick(g, { die: null, storage: null }, el({ freeplace: '0' }))).toEqual({ kind: 'noop' });
    expect(resolveClick(g, { die: null, storage: null }, el({ sellcolor: '3' }))).toEqual({ kind: 'noop' });
    // goods 单元格(带 goods 类)与按钮分支互斥,同样安全回落
    expect(resolveClick(g, { die: null, storage: null }, el({ sellcolor: '3' }, undefined, ['goods']))).toEqual({ kind: 'noop' });
  });

  it('未知元素回落 noop 且不带 flash', () => {
    const g = createGame({ seed: 1, playerCount: 2 });
    expect(resolveClick(g, { die: null, storage: null }, el({}, 'some-random'))).toEqual({ kind: 'noop' });
  });
});
