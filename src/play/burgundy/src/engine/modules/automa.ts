// 自动机(单人模式):官方 AI 对手。
import type { GameState, Tile } from '../state';
import type { ModuleHook } from '../modules';
import { addVP } from '../scoring';
import { rollDie } from '../rng';

export const automaModule: ModuleHook = {
  onSetup(g) {
    const automa = g.players[g.playerCount - 1];
    automa.isAutoma = true;
    automa.automa = {
      deck: [],
      hand: [],
      countyCards: [null, null],
      reserve: [],
      silver: 1,
      goods: [],
      bonusTiles: [],
      scoreModifier: 'normal',
    };
  },
};

/** 自动机回合:按规则书流程执行 */
export function automaTurn(g: GameState, player: number): void {
  const a = g.players[player].automa!;
  const [d1, r1] = rollDie(g.rng);
  g.rng = r1;
  const die = d1;
  // 选郡县卡
  const card = a.countyCards[0] ?? a.countyCards[1];
  if (!card) return;
  // 检索补给区
  const depot = g.depots[die - 1];
  // ... 简化实现:放置第一个匹配的六角片
  g.log.push({ player, text: `自动机:掷骰${die},检索补给区${die}` });
}

/** 自动机放置奖励 */
export function automaPlaceBonus(g: GameState, player: number, tile: Tile): void {
  const a = g.players[player].automa!;
  switch (tile.color) {
    case 'red':
      // 城堡:额外行动
      break;
    case 'brown':
      // 建筑效果
      break;
    case 'green':
      // 牲畜计分
      break;
    case 'blue':
      // 船:拿货物+顺位推进
      break;
    default:
      break;
  }
}
