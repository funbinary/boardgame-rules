// 把 _bga/raw/ 下的 BGA wiki 规则页批量生成为静态游戏页
// 产出: games/bga/<id>.html + assets/js/bga-index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "_bga", "raw");
const OUT_DIR = path.join(ROOT, "games", "bga");
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ---------- 工具 ---------- */
const decodeEntities = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, " ");

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();

function titleCase(id) {
  // hearts -> Hearts; 7wondersdice -> 7 Wonders Dice（尽力拆驼峰）
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .split(/\s+/)
    .map(w => /^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractNameAndPlayers(html, id) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
  const idN = norm(id);
  const body = html.replace(/<div id="toc"[\s\S]*?<\/div>\s*<\/div>/, "")
    .replace(/<span class="mw-editsection"[\s\S]*?<\/span>/g, "");
  const firstPs = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => stripTags(m[1])).filter(t => t.length > 20);
  let name = null, players = null;
  for (const t of firstPs.slice(0, 6)) {
    if (!name) {
      const m = t.match(/^([A-Z0-9][\w'"&:.! -]{1,70}?)\s+(?:is|are)\s+(?:a|an|the)\b/);
      if (m) {
        // 候选名去掉空格标点后须与游戏 id 对得上（前缀匹配），避免抓到句子里无关的词
        const cand = norm(m[1]);
        if (cand === idN || (cand.length >= 3 && (cand.startsWith(idN) || idN.startsWith(cand)))) {
          name = m[1].replace(/\s+$/, "");
        }
      }
    }
    if (!players) {
      const m = t.match(/\b(\d)\s*(?:-|to|–)\s*(\d)\s+players\b/i) || t.match(/\bfor\s+(\d)\s+players\b/i) || t.match(/\b(\d)\s+players\b/i);
      if (m) players = m[2] ? `${m[1]}–${m[2]}` : m[1];
    }
    if (name && players) break;
  }
  return { name, players };
}

/* ---------- HTML 清理 ---------- */
function cleanHtml(html, titleToId, imgMap) {
  let h = html;
  // 去掉可能残留的 TOC 与编辑链接、注释
  h = h.replace(/<div[^>]*id="toc"[\s\S]*?<\/nav>|<div[^>]*id="toc"[\s\S]*?<!--[\s\S]*?-->\s*<\/div>/g, "");
  h = h.replace(/<span class="mw-editsection"[\s\S]*?<\/span>/g, "");
  h = h.replace(/<!--[\s\S]*?-->/g, "");

  // 链接处理
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, inner) => {
    const hrefM = attrs.match(/href="([^"]*)"/);
    if (!hrefM) return inner; // 无 href：只留文字
    let href = decodeEntities(hrefM[1]);
    const text = inner.replace(/<[^>]+>/g, "").trim();
    if (/^\/Gamehelp/i.test(href)) {
      const target = decodeURIComponent(href.slice(1));
      const id = titleToId.get(target);
      if (id) return `<a href="${id}.html">${inner}</a>`;
      return inner; // 目标不存在，退化为纯文本
    }
    if (/^\/(index\.php|wiki)/i.test(href) || /redlink=1/.test(href)) return inner; // 红链/站内杂链 → 文字
    if (/^\/#/.test(href)) return inner;
    if (/^\/(File|Image):/i.test(href)) return inner;
    if (href.startsWith("//")) href = "https:" + href;
    else if (href.startsWith("/")) href = "https://en.doc.boardgamearena.com" + href;
    return `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;
  });

  // 图片: 优先本地化（images-map），否则绝对外链；懒加载
  h = h.replace(/<img\b([^>]*)>/gi, (m, attrs) => {
    const srcM = attrs.match(/src="([^"]*)"/);
    if (!srcM) return "";
    let src = decodeEntities(srcM[1]);
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = "https://en.doc.boardgamearena.com" + src;
    // /images/... 路径 -> 本地文件（若已下载）
    const rel = src.replace("https://en.doc.boardgamearena.com", "");
    if (imgMap[rel]) src = "../../" + imgMap[rel];
    const rest = attrs
      .replace(/\s(src|srcset|width|height)="[^"]*"/g, "")
      .replace(/\sclass="[^"]*"/g, "");
    return `<img src="${src}" loading="lazy" ${rest}>`;
  });
  h = h.replace(/\ssrcset="[^"]*"/g, "");

  return h;
}

/* ---------- 模板 ---------- */
function renderPage({ id, name, sub, players, contentHtml, chip, desc, source, bgg }) {
  const chips = [
    players ? `<span class="meta-chip">👥 ${players} 人</span>` : "",
    bggChipHtml(bgg),
    `<span class="meta-chip">📄 ${chip || "BGA 官方文档"}</span>`,
  ].filter(Boolean).join("\n            ");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="${desc || `${name} 的中文规则（Board Game Arena 官方文档翻译）`}。">
  <title>${name} · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🎲</text></svg>">
  <link rel="stylesheet" href="../../assets/css/style.css">
</head>
<body data-theme="bga">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">${name}</span>
  </header>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <nav class="toc" aria-label="本页目录">
        <div class="toc-title">本页目录</div>
        <ul id="toc-list"></ul>
      </nav>
      <nav aria-label="站点导航">
        <div class="toc-title">站点导航</div>
        <ul>
          <li><a href="../../index.html">🏠 返回首页 / 全部游戏</a></li>
        </ul>
      </nav>
    </aside>
    <div class="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">${name}</h1>
          <p class="game-sub">${sub}</p>
          <div class="meta-chips">
            ${chips}
          </div>
        </header>

        ${contentHtml}

        <footer class="source-note">
          ${source ? `<p>${source}</p>` : `<p>来源：<a href="https://en.doc.boardgamearena.com/Gamehelp${id}" target="_blank" rel="noopener">${name} — BGA 官方文档 Wiki</a> ·
          商标与原内容归各出版商及 BGA 所有，翻译仅供个人学习查阅。</p>`}
        </footer>
      </article>
    </main>
  </div>

  <button class="to-top" aria-label="返回顶部">↑</button>
  <script src="../../assets/js/main.js"></script>
</body>
</html>
`;
}

/* ---------- 主流程 ---------- */
const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith(".json"));
console.log(`读取 ${files.length} 个原始页面…`);

// 1) 按 final title 去重（重定向变体合并）
const byTitle = new Map(); // finalTitle -> {html, firstParas...}
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"));
    const t = d.parse?.title;
    if (!t || !d.parse?.text?.["*"]) continue;
    if (!byTitle.has(t)) byTitle.set(t, d.parse.text["*"]);
  } catch { /* 跳过坏文件 */ }
}
console.log(`去重后 ${byTitle.size} 个游戏`);

// 2) title -> id 映射（供链接重写）
const titleToId = new Map();
for (const t of byTitle.keys()) {
  titleToId.set(t, t.replace(/^Gamehelp/i, ""));
}
// 重定向别名也指到最终页
try {
  const redirects = JSON.parse(fs.readFileSync(path.join(ROOT, "_bga", "redirects.json"), "utf8"));
  // redirects: 原slug -> 最终title（"Gamehelpxxx" 全称）
  for (const [slug, finalTitle] of Object.entries(redirects)) {
    if (titleToId.has(finalTitle)) titleToId.set("Gamehelp" + slug.replace(/^Gamehelp/, ""), finalTitle);
  }
} catch {}

// 图片本地化映射（可能不存在，退回外链）
let imgMap = {};
try { imgMap = JSON.parse(fs.readFileSync(path.join(ROOT, "_bga", "images-map.json"), "utf8")); } catch {}

// BGG 评分（_bgg/results.jsonl 由内置浏览器抓取；文件不存在时页面不带评分 chip）
// 兼容两代字段名：v2 长名(average/usersrated/avgweight/rank)、v3+ 短名(a/u/w/r)
let bggRatings = {};
try {
  for (const l of fs.readFileSync(path.join(ROOT, "_bgg", "results.jsonl"), "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      const r = JSON.parse(l);
      const avg = r.a ?? r.average;
      if (!r.x && avg) bggRatings[r.k] = { ...r, a: avg, u: r.u ?? r.usersrated, w: r.w ?? r.avgweight, r: r.r ?? r.rank };
    } catch { /* 跳过坏行 */ }
  }
} catch { /* 无评分数据 */ }

function fmtWan(n) {
  const v = parseInt(n, 10);
  if (!isFinite(v) || v <= 0) return "";
  return v >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, "") + "万" : String(v);
}

function bggChipHtml(row) {
  if (!row || !row.a) return "";
  const avg = parseFloat(row.a).toFixed(1);
  const rank = row.r ? ` · 排名 #${row.r}` : "";
  const wv = parseFloat(row.w);
  const weight = isFinite(wv) && wv > 0 ? ` · 权重 ${wv.toFixed(2)}/5` : "";
  const u = fmtWan(row.u);
  const users = u ? ` · ${u}人评分` : "";
  const href = row.i ? `https://boardgamegeek.com/boardgame/${row.i}` : "https://boardgamegeek.com";
  return `<a class="meta-chip bgg-chip" href="${href}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${avg}，排名 #${row.r || "-"}，权重/复杂度 ${isFinite(wv) && wv > 0 ? wv.toFixed(2) : "-"}/5（1 轻松 ~ 5 重度），${u || "-"}人评分。点击查看原页面">⭐ BGG ${avg}${rank}${weight}${users}</a>`;
}

// 3) 生成页面（content/bga-zh/<id>.html 有中文版则优先使用；bga-names-zh.json 提供中文译名）
const ZH_DIR = path.join(ROOT, "content", "bga-zh");
fs.mkdirSync(ZH_DIR, { recursive: true });
let nameZh = {};
try { nameZh = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "bga-names-zh.json"), "utf8")); } catch {}
let written = 0, zhCount = 0;
const index = [];
for (const [title, html] of byTitle) {
  const id = titleToId.get(title);
  const zhFile = path.join(ZH_DIR, id + ".html");
  let contentHtml, players;
  if (fs.existsSync(zhFile)) {
    contentHtml = fs.readFileSync(zhFile, "utf8");
    zhCount++;
  } else {
    contentHtml = cleanHtml(html, titleToId, imgMap);
  }
  // 页头元信息可被 content/bga-zh/<id>.meta.json 覆盖（来源非 BGA 文档的中文页用）
  let meta = {};
  const metaFile = path.join(ZH_DIR, id + ".meta.json");
  if (fs.existsSync(metaFile)) {
    try { meta = JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch { /* 忽略坏文件 */ }
  }
  const info = extractNameAndPlayers(html, id);
  players = meta.players || info.players;
  const en = info.name && info.name.length <= 60 ? info.name : titleCase(id);
  const name = nameZh[id] || en; // 中文名优先展示
  const sub = meta.sub || (nameZh[id] ? `${en} · Board Game Arena 官方规则文档` : "Board Game Arena 官方规则文档");
  const page = renderPage({ id, name, sub, players, contentHtml, chip: meta.chip, desc: meta.desc, source: meta.source, bgg: bggRatings[id] || null });
  fs.writeFileSync(path.join(OUT_DIR, id + ".html"), page);
  index.push({ id, name, en: name === en ? "" : en, players: players || "" });
  written++;
}

// 4) 索引数据
index.sort((a, b) => a.name.localeCompare(b.name, "en"));
fs.writeFileSync(
  path.join(ROOT, "assets", "js", "bga-index.js"),
  "// 自动生成：node tools/build-bga.mjs\nwindow.BGA_GAMES = " + JSON.stringify(index) + ";\n"
);

console.log(`已生成 ${written} 个页面 -> games/bga/（其中中文 ${zhCount} 个）`);
console.log(`索引 ${index.length} 条 -> assets/js/bga-index.js`);
