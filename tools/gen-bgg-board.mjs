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

// ===== BGG 总榜（含未上架 BGA 的全部有排名桌游）=====
// 数据源：_bgg/full-board.jsonl（BGG browse 榜单页 33 页装配结果，见 _bgg/assemble-board.mjs）
// 关联：BGA 在架状态（上方 fresh 清单）+ 本站规则页（games/bga/* 与 games/* 文件名）+ BGG id（results.jsonl 标题）
const boardPath = path.join(ROOT, "_bgg", "full-board.jsonl");
if (fs.existsSync(boardPath)) {
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^the(?=[a-z0-9]{3})/, "");
  // BGA 在架：norm(en) 与 norm(slug) 双索引
  const live = new Map();
  for (const g of fresh) {
    const e = { slug: g.name, en: g.en || "", status: g.status, zh: zhById.get(g.name) || zhMap[g.name] || "", bggId: g.bggId || null };
    for (const key of [g.en || "", g.name]) {
      const k = norm(key);
      if (k && !live.has(k)) live.set(k, e);
    }
  }
  // 本站规则页：games/bga/<slug>.html（含已下架）与 games/<slug>.html（手工页）
  const site = new Map(); // norm -> href
  for (const f of fs.readdirSync(path.join(ROOT, "games", "bga"))) {
    if (!f.endsWith(".html")) continue;
    const slug = f.slice(0, -5);
    const k = norm(slug);
    if (k && !site.has(k)) site.set(k, "games/bga/" + slug + ".html");
  }
  for (const f of fs.readdirSync(path.join(ROOT, "games"))) {
    if (!f.endsWith(".html")) continue;
    const slug = f.slice(0, -5);
    const k = norm(slug);
    if (k && !site.has(k)) site.set(k, "games/" + slug + ".html");
  }
  // BGG id（按标题，兜底 live 匹配）
  const bggIdByTitle = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, "_bgg", "results.jsonl"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.i && (r.title || r.s)) {
      const t = norm(r.title || r.s);
      if (t && !bggIdByTitle.has(t)) bggIdByTitle.set(t, r.i);
    }
  }

  const full = [];
  const rowsRaw = fs.readFileSync(boardPath, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const presentRanks = new Set(rowsRaw.map(r => r.r));
  const presentNorms = new Set(rowsRaw.map(r => norm(r.n)));
  // 空槽注入：用既有 BGG 抓取（BGA 游戏为主）补齐 browse 缺失的名次（geek 值未知留空）
  const fillByRank = new Map();
  for (const line of fs.readFileSync(path.join(ROOT, "_bgg", "results.jsonl"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const rank = +((r.r ?? r.rank) || 0);
    const title = r.title || r.s;
    if (!rank || rank > 3300 || !title || (r.x && !r.a && !r.average)) continue;
    const avg = (r.a ?? r.average) || null;
    if (!avg) continue;
    if (!fillByRank.has(rank)) fillByRank.set(rank, { title, avg, users: +((r.u ?? r.usersrated) || 0), year: (r.y ?? r.year) || "", i: r.i || null });
  }
  let injected = 0;
  for (const r of rowsRaw) full.push(r);
  for (const [rk, info] of [...fillByRank.entries()].sort((a, b) => a[0] - b[0])) {
    if (presentRanks.has(rk)) continue;
    if (presentNorms.has(norm(info.title))) continue; // 已在其他名次（快照漂移）
    full.push({ r: rk, n: info.title, y: String(info.year), g: "", a: String(Math.round(parseFloat(info.avg) * 100) / 100), v: info.users, inj: 1, fillId: info.i || null });
    presentRanks.add(rk); presentNorms.add(norm(info.title));
    injected++;
  }
  full.sort((a, b) => a.r - b.r);
  const outRows = [];
  for (const r of full) {
    const k = norm(r.n);
    const lv = live.get(k) || null;
    const href = site.get(k) || null;
    const row = { r: r.r, n: r.n, y: r.y, g: r.g, a: r.a, v: r.v };
    if (r.inj) {
      row.j = 1; // 注入行（browse 缺槽，用本站既有抓取数据补；显示名优先 BGA 官方英文名）
      if (lv && lv.en) row.n = lv.en;
      else row.n = String(r.n).replace(/-/g, " ").replace(/([a-z])/g, (m, c) => c.toUpperCase());
    }
    if (lv) {
      row.st = lv.status === "beta" ? "b" : "p";
      if (lv.zh) row.z = lv.zh;
    } else if (href) {
      row.st = "o"; // 曾上架/已下架（本站有规则页）
    }
    if (href) row.p = href;
    const bggId = (lv && lv.bggId) || bggIdByTitle.get(k) || (r.fillId ? String(r.fillId) : null);
    if (bggId) row.b = parseInt(bggId, 10);
    outRows.push(row);
  }
  const fstats = {
    total: outRows.length,
    injected,
    onBga: outRows.filter(x => x.st === "p" || x.st === "b").length,
    notOnBga: outRows.filter(x => !x.st).length,
    delisted: outRows.filter(x => x.st === "o").length,
    withSite: outRows.filter(x => x.p).length,
  };
  const fjs = "// 自动生成：node tools/gen-bgg-board.mjs（BGG browse 总榜 × BGA/本站关联）\n"
    + "// 短键：r=BGG总排名 n=游戏名 y=年份 g=Geek评分(注入行可能为空) a=平均分 v=评分人数\n"
    + "//       st=p在架/b在架Beta/o曾上架(已下架)|无=未上架BGA z=中文名 p=本站规则页链接 b=BGG词条id j=注入行\n"
    + "window.BGG_FULL_BOARD = " + JSON.stringify({ updated, stats: fstats, games: outRows }) + ";\n";
  fs.writeFileSync(path.join(ROOT, "assets", "js", "bgg-full-board.js"), fjs);
  console.log(`BGG 总榜：${fstats.total} 款（注入补缺 ${injected}；在架 ${fstats.onBga} / 未上架 ${fstats.notOnBga} / 已下架有页 ${fstats.delisted} / 本站规则页 ${fstats.withSite}）`);
  console.log(`-> assets/js/bgg-full-board.js（${(fjs.length / 1024).toFixed(0)}KB）`);
} else {
  console.log("（跳过 BGG 总榜：_bgg/full-board.jsonl 不存在）");
}
