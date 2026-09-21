// 状态哈希:联机对账(各客户端重放后必须一致)
export function hashState(state: unknown): string {
  const json = JSON.stringify(state, replacer);
  // FNV-1a 64(用两个 32 位拼)足够检测 desync
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < json.length; i++) {
    const ch = json.charCodeAt(i);
    h1 ^= ch; h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + Math.imul(ch + i, 2654435761)) >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function replacer(_k: string, v: unknown): unknown {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // 数组保留顺序,对象按键排序(消除两端原型/属性顺序差异)
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(o).sort()) sorted[key] = o[key];
    return sorted;
  }
  return v;
}
