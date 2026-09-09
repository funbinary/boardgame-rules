// 给 games/ 下手工整理的中文规则页写入 BGG 评分 chip（幂等：已有 chip 则原位替换，可重复执行）
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

const chipHtml = (key) => {
  const r = ratings[key];
  if (!r) return null;
  const rank = r.r ? ` · 排名 #${r.r}` : "";
  const weight = r.w ? ` · 权重 ${r.w.toFixed(2)}/5` : "";
  const u = fmtWan(r.u);
  const users = u ? ` · ${u}人评分` : "";
  return `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${r.i}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${r.a.toFixed(1)}，排名 #${r.r || "-"}，权重/复杂度 ${r.w ? r.w.toFixed(2) : "-"}/5（1 轻松 ~ 5 重度），${u || "-"}人评分。点击查看原页面">⭐ BGG ${r.a.toFixed(1)}${rank}${weight}${users}</a>`;
};

// 用法：node tools/add-bgg-chips-manual.mjs [slug]
//   带参数只处理该 slug；不带参数处理全部已收录页面
const pages = process.argv[2]
  ? [process.argv[2]]
  : [
      "7-wonders", "brass-birmingham", "vale-of-eternity",
      "pokemon-grove", "wingspan", "puerto-rico", "barcelona",
      "dune-imperium",
    ];
const chipRe = /<a class="meta-chip bgg-chip"[^>]*>⭐ BGG[^<]*<\/a>/;

for (const key of pages) {
  const file = path.join(ROOT, "games", key + ".html");
  let html = fs.readFileSync(file, "utf8");
  const chip = chipHtml(key);
  if (!chip) { console.log(`${key}: 无评分数据，跳过`); continue; }
  if (chipRe.test(html)) {
    html = html.replace(chipRe, chip);
    fs.writeFileSync(file, html);
    console.log(`${key}: 已替换 ${chip.match(/⭐ BGG[^<]*/)[0]}`);
    continue;
  }
  const anchor = html.match(/<div class="meta-chips">\s*\n/);
  if (!anchor) { console.log(`${key}: 找不到 meta-chips 插入点，跳过`); continue; }
  const pos = anchor.index + anchor[0].length;
  html = html.slice(0, pos) + "            " + chip + "\n" + html.slice(pos);
  fs.writeFileSync(file, html);
  console.log(`${key}: 已注入 ${chip.match(/⭐ BGG[^<]*/)[0]}`);
}
