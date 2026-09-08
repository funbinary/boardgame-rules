// 把 _bgg/results.jsonl（内置浏览器抓取的 BGG 数据）转成站点数据文件
// 产出: assets/js/bgg-ratings.js（window.BGG_RATINGS）+ _bgg/summary.txt
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "_bgg", "results.jsonl");
const rows = fs.readFileSync(SRC, "utf8").split("\n").filter(Boolean)
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

const out = {};
for (const r of rows) {
  if (r.x) continue; // 抓取失败 / 无结果
  // 兼容两代字段名：v2 长名(average/usersrated/avgweight/rank)、v3+ 短名(a/u/w/r)
  const avg = parseFloat(r.a ?? r.average);
  if (!isFinite(avg) || avg <= 0) continue;
  const e = { a: Math.round(avg * 10) / 10, i: parseInt(r.i, 10) };
  const u = parseInt(r.u ?? r.usersrated, 10);
  if (isFinite(u) && u > 0) e.u = u;
  const rank = parseInt(r.r ?? r.rank, 10);
  if (isFinite(rank) && rank > 0) e.r = rank;
  const w = parseFloat(r.w ?? r.avgweight);
  if (isFinite(w) && w > 0) e.w = Math.round(w * 100) / 100;
  out[r.k] = e;
}

const js = "// 自动生成：node tools/gen-bgg-data.mjs（数据源自 BoardGameGeek 抓取）\n"
  + "window.BGG_RATINGS = " + JSON.stringify(out) + ";\n";
fs.writeFileSync(path.join(ROOT, "assets", "js", "bgg-ratings.js"), js);

// 摘要
const keys = new Set(rows.map(r => r.k));
const missing = rows.filter(r => r.x || !out[r.k]).map(r => r.k + (r.x ? " (" + r.x + ")" : ""));
const summary = [
  `抓取条目: ${rows.length}`,
  `有评分数据: ${Object.keys(out).length}`,
  `无评分/失败: ${rows.length - Object.keys(out).length}`,
  "",
  "无评分清单:",
  ...missing.map(m => "  " + m),
].join("\n");
fs.writeFileSync(path.join(ROOT, "_bgg", "summary.txt"), summary);
console.log(summary.split("\n").slice(0, 4).join("\n"));
console.log(`-> assets/js/bgg-ratings.js（${Object.keys(out).length} 条）`);
