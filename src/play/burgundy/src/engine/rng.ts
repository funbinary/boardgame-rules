// mulberry32 种子随机 —— RNG 状态内嵌 GameState,保证所有客户端重放一致。
// 接口约定:不修改传入对象,返回新状态(引擎整体采用"克隆后应用"的纯函数风格)。

export interface RngState { s: number }

export function rngInit(seed: number): RngState {
  // 避免极小种子退化
  return { s: seed >>> 0 || 0x9e3779b9 };
}

/** 返回 [1-6 的骰点, 新RNG状态] */
export function rollDie(rng: RngState): [number, RngState] {
  const [v, s] = nextU32(rng);
  return [(v % 6) + 1, { s }];
}

/** 返回 [0..n-1 的均匀整数, 新RNG状态] */
export function randInt(rng: RngState, n: number): [number, RngState] {
  const [v, s] = nextU32(rng);
  return [(v % n), { s }];
}

function nextU32(rng: RngState): [number, number] {
  let t = (rng.s + 0x6d2b79f5) >>> 0;
  let x = t;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return [(x ^ (x >>> 14)) >>> 0, t];
}

/** Fisher–Yates 洗牌(返回新数组与新RNG状态) */
export function shuffle<T>(rng: RngState, arr: readonly T[]): [T[], RngState] {
  const a = arr.slice();
  let r = rng;
  for (let i = a.length - 1; i > 0; i--) {
    const [j, nr] = randInt(r, i + 1);
    r = nr;
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return [a, r];
}
