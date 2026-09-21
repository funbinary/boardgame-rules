import { rngInit, rollDie } from '../src/play/burgundy/src/engine/rng.ts';
const r0 = rngInit(-1472827631941556000);
const d1 = rollDie(r0);
const d2 = rollDie(d1[1]);
console.log('node: s0=' + r0.s + ' roll1=' + d1[0] + ' roll2=' + d2[0]);
console.log('ToUint32 via >>>:', -1472827631941556000 >>> 0);
