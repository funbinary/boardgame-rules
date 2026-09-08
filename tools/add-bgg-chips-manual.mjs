// 给 games/ 下 6 个手工整理的中文规则页注入 BGG 评分 chip（幂等，可重复执行）
// games/bga/ 下的手工转录页（agricola/hegemony/arnak）由 build-bga.mjs 自动注入，无需处理
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const idxSrc = fs.readFileSync(path.join(ROOT, "assets", "js", "bgg-ratings.js"), "utf8");
const ratings = JSON.parse(idxSrc.slice(idxSrc.indexOf("{"), idxSrc.lastIndexOf("}") + 1));

const fmtWan = (n) => {
  const v = parseInt(n, 10);
  if (!isFinite(v) || v <= 0) return "";
  return v >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, "") + "万" : String(v);
};

const pages = [
  "7-wonders", "brass-birmingham", "vale-of-eternity",
  "pokemon-grove", "wingspan", "puerto-rico", "barcelona",
];

for (const key of pages) {
  const file = path.join(ROOT, "games", key + ".html");
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("bgg-chip")) { console.log(`${key}: 已有 chip，跳过`); continue; }
  const r = ratings[key];
  if (!r) { console.log(`${key}: 无评分数据，跳过`); continue; }
  const rank = r.r ? ` · 排名 #${r.r}` : "";
  const u = fmtWan(r.u);
  const users = u ? ` · ${u}人评分` : "";
  const chip = `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${r.i}" target="_blank" rel="noopener" title="BoardGameGeek 综合评分（点击查看原页面）">⭐ BGG ${r.a.toFixed(1)}${rank}${users}</a>`;
  const anchor = html.match(/<div class="meta-chips">\s*\n/);
  if (!anchor) { console.log(`${key}: 找不到 meta-chips 插入点，跳过`); continue; }
  const pos = anchor.index + anchor[0].length;
  html = html.slice(0, pos) + "            " + chip + "\n" + html.slice(pos);
  fs.writeFileSync(file, html);
  console.log(`${key}: 已注入 ${chip.match(/⭐[^<]*/)[0]}`);
}
