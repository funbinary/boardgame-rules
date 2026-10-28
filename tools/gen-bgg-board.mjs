// 生成 BGA×BGG 榜单数据文件 assets/js/bga-bgg-board.js（bgg-ranking.html 消费）
// 输入（均为本地既有数据，_bga/_bgg 为 gitignore 抓取域，产物 js 提交入库）：
//   _bga/gamelist-*.json     内置浏览器抓的 BGA 在架全量清单（取文件名最新一份）
//   _bgg/results.jsonl       BGG 抓取结果（v2 长名/v3 短名两代字段，兼容读取）
//   assets/js/bga-index.js   站点游戏索引（中文名）
//   content/bga-names-zh.json 中文名映射
//   games/bga/<slug>.html 是否存在 → 本站有无规则页（h）
// 补抓 BGG 后（_bgg/results.jsonl 更新）重跑本脚本即自动刷新页面数据。
// 用法：node tools/gen-bgg-board.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 取最新的 gamelist-*.json
const glDir = path.join(ROOT, "_bga");
const glFiles = fs.readdirSync(glDir).filter(f => /^gamelist-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
if (!glFiles.length) {
  console.error("未找到 _bga/gamelist-*.json（需先用内置浏览器抓 BGA gamelist）");
  process.exit(1);
}
const glFile = glFiles[glFiles.length - 1];
const updated = glFile.match(/\d{4}-\d{2}-\d{2}/)[0];
const fresh = JSON.parse(fs.readFileSync(path.join(glDir, glFile), "utf8"));

// 中文名：bga-index 的 name 字段含中文的用之，其次 bga-names-zh.json
const idxSrc = fs.readFileSync(path.join(ROOT, "assets", "js", "bga-index.js"), "utf8");
const idx = JSON.parse(idxSrc.slice(idxSrc.indexOf("["), idxSrc.lastIndexOf("]") + 1));
const zhById = new Map(idx.map(g => [g.id, g.name && /[\u4e00-\u9fff]/.test(g.name) ? g.name : ""]));
const zhMap = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "bga-names-zh.json"), "utf8"));

// BGG 结果：成功行按 bgg id 与 slug 双索引（同 gen-report 的合并口径）
const ok = r => (r.average || r.a) && !r.x;
const byI = new Map(), byK = new Map();
for (const line of fs.readFileSync(path.join(ROOT, "_bgg", "results.jsonl"), "utf8").split("\n")) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  if (!ok(r)) continue;
  if (r.i) byI.set(String(r.i), r);
  if (r.k) byK.set(r.k, r);
}
const num = v => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : null; };
const int = v => { const n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : null; };

// players 数组 → "1–4" / "2–4,6" 区间串（en dash）
const playersStr = arr => {
  if (!arr || !arr.length) return "";
  const s = [...arr].sort((a, b) => a - b);
  const parts = []; let start = s[0], prev = s[0];
  for (const n of [...s.slice(1), null]) {
    if (n != null && n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (n != null) start = prev = n;
  }
  return parts.join(",");
};

const games = fresh.map(g => {
  const r = (g.bggId ? byI.get(String(g.bggId)) : null) || byK.get(g.name) || null;
  const row = {
    s: g.name,                                   // BGA slug
    e: g.en || "",                               // 英文名
    z: zhById.get(g.name) || zhMap[g.name] || "",// 中文名
  };
  if (g.bggId) row.b = g.bggId;                  // BGG 词条 id
  if (r) {
    const a = num(r.a ?? r.average); if (a) row.a = Math.round(a * 100) / 100;
    const u = int(r.u ?? r.usersrated); if (u) row.u = u;
    const w = num(r.w ?? r.avgweight); if (w) row.w = Math.round(w * 100) / 100;
    const rk = int(r.r ?? r.rank); if (rk) row.r = rk;
  }
  if (g.players && g.players.length) row.p = playersStr(g.players);
  if (g.duration) row.d = g.duration;            // 平均时长(分)
  if (g.plays) row.g = g.plays;                  // BGA 累计场次
  if (g.status === "beta") row.st = "b";
  if (g.premium) row.pr = 1;
  if (fs.existsSync(path.join(ROOT, "games", "bga", g.name + ".html"))) row.h = 1;
  return row;
});

const have = games.filter(g => g.a);
const stats = {
  total: games.length,
  have: have.length,
  ranked: have.filter(g => g.r).length,
  pending: games.filter(g => !g.a && g.b).length,
  noid: games.filter(g => !g.b && !g.a).length,
  beta: games.filter(g => g.st === "b").length,
};

const js = "// 自动生成：node tools/gen-bgg-board.mjs（BGA gamelist 页面内嵌清单 × BGG 抓取结果）\n"
  + "// 短键：s=slug e=英文名 z=中文名 b=BGG词条id a=评分 r=总排名 u=评分人数 w=权重\n"
  + "//       p=支持人数 d=平均时长(分) g=BGA累计场次 st=b(Beta) pr=付费 h=本站有规则页\n"
  + "window.BGA_BGG_BOARD = " + JSON.stringify({ updated, stats, games }) + ";\n";
fs.writeFileSync(path.join(ROOT, "assets", "js", "bga-bgg-board.js"), js);
console.log(`数据日期 ${updated}：共 ${stats.total} 款，有评分 ${stats.have}（含排名 ${stats.ranked}），待补 ${stats.pending}，无词条 ${stats.noid}，Beta ${stats.beta}`);
console.log(`-> assets/js/bga-bgg-board.js（${(js.length / 1024).toFixed(0)}KB）`);
