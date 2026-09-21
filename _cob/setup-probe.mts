import { createGame } from '../src/play/burgundy/src/engine/setup.ts';
import { hashState } from '../src/play/burgundy/src/engine/hash.ts';
const g = createGame({ seed: -1472827631941556000, playerCount: 2 });
console.log('node h0:', hashState(g));
console.log('seedOut:', g.rng.s, 'boards:', g.players.map(p => p.boardId).join(','), 'pending:', g.pending.length);
console.log('goods0:', JSON.stringify(g.players[0].goods));
console.log('depots0:', g.depots[0].cells.map(c => c && (c.monastery ?? c.building ?? c.livestock ?? c.color)).join(','));
