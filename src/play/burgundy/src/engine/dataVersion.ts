// 数据指纹:对全部勘定数据 JSON 计算稳定哈希(P4)。
// 联机建房时上报入库、加入/重连时与本地比对 —— 房间与客户端数据版本不一致时
// 同种子重放会分叉(哈希对账报 desync),此处提前拦截并给出明确提示。
// 口径:全文件哈希(含 _meta 注记)。改注释也会换版本属可接受的误报;老房间
// dataVersion 为空串(历史数据),视为未知、跳过校验。
import centralJson from './data/central.json';
import boardsJson from './data/boards.json';
import tilesJson from './data/tiles.json';
import monasteriesJson from './data/monasteries.json';
import automaJson from './data/automa.json';
import tradeJson from './data/traderoute.json';
import vineyardJson from './data/vineyard.json';
import modulesJson from './data/modules.json';

let cached = '';

/** FNV-1a 32 位;跨文件拼接以 '|' 分隔避免边界歧义 */
function fnv(s: string): string {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x.toString(16).padStart(8, '0');
}

export function dataVersion(): string {
  if (cached) return cached;
  const parts = [
    JSON.stringify(centralJson),
    JSON.stringify(boardsJson),
    JSON.stringify(tilesJson),
    JSON.stringify(monasteriesJson),
    JSON.stringify(automaJson),
    JSON.stringify(tradeJson),
    JSON.stringify(vineyardJson),
    JSON.stringify(modulesJson),
  ];
  cached = 'dv1-' + fnv(parts.join('|'));
  return cached;
}
