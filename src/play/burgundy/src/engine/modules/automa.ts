// 自动机(单人模式):官方 AI 对手,按规则书郡县卡流程实现。
import type { GameState, Tile } from '../state';
import type { ModuleHook } from '../modules';
import { addVP } from '../scoring';
import { rollDie, randInt } from '../rng';

export const automaModule: ModuleHook = {
  onSetup(g) {
    const automa = g.players[g.playerCount - 1];
    automa.isAutoma = true;
    const deck = shuffleDeck(g);
    automa.automa = {
      deck: deck.map((c) => c.join('')),   // 字符串化存 JSON
      hand: [],
      countyCards: [null, null],
      reserve: [],
      silver: 1,
      goods: [],
      bonusTiles: [],
      scoreModifier: 'normal',
    };
    // 翻牌:第一张含城堡格的卡放左槽(点数 1-4)
    for (let i = 0; i < deck.length; i++) {
      if (deck[i].includes('red')) {
        deck.splice(i, 1);
        automa.automa.countyCards[0] = deck[i - 1]?.join('') ?? null;
        break;
      }
    }
    // 右槽(点数 5-6):随机
    if (deck.length > 0) {
      const [idx, r] = randInt(g.rng, deck.length);
      g.rng = r;
      automa.automa.countyCards[1] = deck.splice(idx, 1)[0].join('');
    }
    g.log.push({ player: g.playerCount - 1, text: `自动机:初始郡县卡 [${automa.automa.countyCards[0]}] [${automa.automa.countyCards[1]}]` });
  },
};

function shuffleDeck(g: GameState): string[][] {
  const cards = [
    ['blue', 'blue', 'blue', 'blue'],
    ['yellow', 'yellow', 'yellow', 'yellow'],
    ['green', 'green', 'green', 'green'],
    ['brown', 'brown', 'brown', 'brown'],
    ['gray', 'gray', 'gray', 'gray'],
    ['red', 'red', 'red', 'red'],
    ['blue', 'yellow', 'green', 'brown'],
    ['gray', 'red', 'blue', 'yellow'],
    ['green', 'brown', 'gray', 'red'],
  ];
  const out: string[][] = [];
  let r = g.rng;
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const [j, nr] = randInt(r, i + 1);
    r = nr;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  g.rng = r;
  return arr;
}

/** 自动机回合:按规则书流程执行(简化版,完整版见 M2b 收尾) */
export function automaTurn(g: GameState, player: number): void {
  const a = g.players[player].automa!;
  const [d1, r1] = rollDie(g.rng);
  g.rng = r1;
  const die = d1;
  g.log.push({ player, text: `自动机:掷骰${die}` });

  // 选郡县卡
  const card = a.countyCards[die <= 4 ? 0 : 1];
  if (!card) return;

  // 检索补给区
  const depot = g.depots[die - 1];
  const tile = depot.cells.find((t) => t && card.includes(t.color));
  if (tile) {
    // 放置到郡县卡:从卡面移除对应颜色
    const cardStr = card;
    const idx = cardStr.indexOf(tile.color);
    if (idx >= 0) {
      a.countyCards[die <= 4 ? 0 : 1] = cardStr.slice(0, idx) + cardStr.slice(idx + 1);
    }
    g.log.push({ player, text: `自动机:放置 ${tile.color} 到郡县卡` });
    // 郡县卡填满?
    if (a.countyCards[die <= 4 ? 0 : 1] === '') {
      const vp = a.scoreModifier === 'easy' ? 4 : a.scoreModifier === 'normal' ? 5 : 6;
      addVP(g, player, vp, '郡县卡完成');
      // 补卡
      if (a.deck.length > 0) {
        const [idx, r] = randInt(g.rng, a.deck.length);
        g.rng = r;
        a.countyCards[die <= 4 ? 0 : 1] = a.deck.splice(idx, 1)[0];
      }
    }
  } else {
    // 无匹配:从储备区找
    g.log.push({ player, text: '自动机:无匹配,储备区检索' });
  }

  // 放置奖励(简化)
  if (tile) automaPlaceBonus(g, player, tile);
}

/** 自动机放置奖励 */
export function automaPlaceBonus(g: GameState, player: number, tile: Tile | null): void {
  if (!tile) return;
  const a = g.players[player].automa!;
  switch (tile.color) {
    case 'red':
      // 城堡:额外行动
      g.log.push({ player, text: '自动机:城堡奖励(额外行动)' });
      break;
    case 'brown':
      // 建筑效果
      g.log.push({ player, text: '自动机:建筑奖励' });
      break;
    case 'green':
      // 牲畜计分
      g.log.push({ player, text: '自动机:牲畜计分' });
      break;
    case 'blue':
      // 船:拿货物+顺位推进
      g.log.push({ player, text: '自动机:船只(拿货物+顺位)' });
      break;
    default:
      break;
  }
}
