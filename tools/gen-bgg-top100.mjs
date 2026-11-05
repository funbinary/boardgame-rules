// 生成「BGG Top 100 中英对照」数据 assets/js/bgg-top100.js（bgg-ranking.html 第三视图消费），
// 并把 content/bgg-top100.json 里核实过的中文名回注到 assets/js/bgg-full-board.js（只补空缺，不覆盖——
// 总榜既有 z 来自 BGA 官方中文名，优先级更高；回注不改动总榜的排名/评分，两份快照各自带 updated）。
// 输入：
//   content/bgg-top100.json          人工维护的单一事实源（快照日期 + 100 款 en/zh/y/g/a/v）
//   assets/js/bgg-full-board.js      gen-bgg-board.mjs 产物（提供 b=BGG词条id st=BGA状态 p=本站规则页）
// 用法：node tools/gen-bgg-top100.mjs（改完 top100.json 或总榜重建后重跑）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "window.BGG_FULL_BOARD = ";
// 名字归一：大小写、空格、破折号(–—)、标点全剥，Dune: Imperium – Uprising 与 - Uprising 应同键
const norm = s => String(s).toLowerCase().replace(/[–—]/g, "-").replace(/[\s'"’.!:,()?&]/g, "");

const src = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "bgg-top100.json"), "utf8"));
if (!src.games || src.games.length !== 100) {
  console.error(`content/bgg-top100.json 应为 100 款，现为 ${src.games ? src.games.length : 0} 款`);
  process.exit(1);
}

const fbPath = path.join(ROOT, "assets", "js", "bgg-full-board.js");
const fbSrc = fs.readFileSync(fbPath, "utf8");
const fb = JSON.parse(fbSrc.slice(fbSrc.indexOf(MARK) + MARK.length, fbSrc.lastIndexOf(";")));
const byNorm = new Map(fb.games.map(g => [norm(g.n), g]));

let linked = 0;
const games = src.games.map(t => {
  const row = { r: t.r, en: t.en, zh: t.zh, y: t.y, g: t.g, a: t.a, v: t.v };
  const m = byNorm.get(norm(t.en));
  if (m) {
    if (m.b) row.b = m.b;
    if (m.st) row.st = m.st;
    if (m.p) row.p = m.p;
    linked++;
  }
  return row;
});

// 回注中文名到总榜
const zhByNorm = new Map(src.games.map(t => [norm(t.en), t.zh]));
let zFilled = 0;
for (const g of fb.games) {
  if (g.z) continue;
  const zh = zhByNorm.get(norm(g.n));
  if (zh) { g.z = zh; zFilled++; }
}
if (zFilled) {
  fs.writeFileSync(fbPath, fbSrc.slice(0, fbSrc.indexOf(MARK) + MARK.length) + JSON.stringify(fb) + ";\n");
}

const stats = {
  total: games.length,
  matched: linked,
  onBga: games.filter(g => g.st === "p" || g.st === "b").length,
  withSite: games.filter(g => g.p).length,
};
const js = "// 自动生成：node tools/gen-bgg-top100.mjs（content/bgg-top100.json → bgg-ranking.html「Top 100 中英对照」视图）\n"
  + "// 短键：r=排名 en=英文名 zh=中文名 y=年份 g=Geek评分 a=平均分 v=评分人数 b=BGG词条id st=BGA状态(p/b/o) p=本站规则页\n"
  + "window.BGG_TOP100 = " + JSON.stringify({ updated: src.updated, stats, games }) + ";\n";
fs.writeFileSync(path.join(ROOT, "assets", "js", "bgg-top100.js"), js);

console.log(`Top100：${games.length} 款（关联总榜 ${linked}；BGA 可玩 ${stats.onBga}；本站规则页 ${stats.withSite}）`);
console.log(`回注中文名到总榜：${zFilled} 行`);
console.log(`-> assets/js/bgg-top100.js（${(js.length / 1024).toFixed(1)}KB）`);
