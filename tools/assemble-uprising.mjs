// 把 content/dune-imperium-uprising.md（英文官方规则书全文翻译）装配为 games/dune-imperium-uprising.html
// 用法: node tools/assemble-uprising.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MD = path.join(ROOT, "content", "dune-imperium-uprising.md");
const OUT = path.join(ROOT, "games", "dune-imperium-uprising.html");

/* ---------- 迷你 Markdown → HTML ---------- */
function inline(t) {
  t = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s（（>])(https?:\/\/[^\s<））)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return t;
}

function md2html(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let para = [], quote = [], ul = false, ol = false;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushQuote = () => {
    if (!quote.length) return;
    const groups = [[]];
    for (const q of quote) { if (q === "\x00P\x00") groups.push([]); else groups[groups.length - 1].push(q); }
    out.push(`<blockquote>${groups.filter(g => g.length).map(g => `<p>${inline(g.join(" "))}</p>`).join("")}</blockquote>`);
    quote = [];
  };
  const flushList = () => { ul = false; ol = false; };
  const closeAll = () => { flushPara(); flushQuote(); if (ul) out.push("</ul>"); if (ol) out.push("</ol>"); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) { closeAll(); continue; }
    if (trimmed.startsWith("# ")) continue; // 文档标题不入正文
    const fig = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (fig) {
      closeAll();
      out.push(`<figure>\n<img src="${fig[2]}" alt="${fig[1]}" loading="lazy">\n<figcaption>${fig[1]}</figcaption>\n</figure>`);
      continue;
    }
    const h = trimmed.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      closeAll();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushPara();
      if (ul) { out.push("</ul>"); ul = false; }
      if (ol) { out.push("</ol>"); ol = false; }
      const text = trimmed.replace(/^>\s?/, "");
      if (!text) { if (quote.length) quote.push("\x00P\x00"); } // 引用内分段标记
      else quote.push(text);
      continue;
    }
    if (quote.length) flushQuote();
    const li = trimmed.match(/^-\s+(.*)$/);
    if (li) {
      flushPara();
      if (ol) { out.push("</ol>"); ol = false; }
      if (!ul) { out.push("<ul>"); ul = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    const ol2 = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ol2) {
      flushPara();
      if (ul) { out.push("</ul>"); ul = false; }
      if (!ol) { out.push("<ol>"); ol = true; }
      out.push(`<li>${inline(ol2[1])}</li>`);
      continue;
    }
    flushQuote();
    if (ul) { out.push("</ul>"); ul = false; }
    if (ol) { out.push("</ol>"); ol = false; }
    para.push(trimmed);
  }
  closeAll();
  return out.join("\n");
}

/* ---------- 页面模板 ---------- */
const body = md2html(fs.readFileSync(MD, "utf8"));

const SIDEBAR_GAMES = `
          <li><a href="../index.html">🏠 返回首页</a></li>
          <li><a href="7-wonders.html">🏛️ 七大奇迹</a></li>
          <li><a href="brass-birmingham.html">🏭 工业革命：伯明翰</a></li>
          <li><a href="vale-of-eternity.html">✨ 永恒之谷</a></li>
          <li><a href="wingspan.html">🦜 展翅翱翔</a></li>
          <li><a href="pokemon-grove.html">🌳 宝可梦林地探索</a></li>
          <li><a href="puerto-rico.html">⛵ 波多黎各</a></li>
          <li><a href="barcelona.html">🌸 巴塞罗那</a></li>
          <li><a href="dune-imperium.html">🏜️ 沙丘：帝国</a></li>
          <li><a href="dune-imperium-uprising.html">🪱 沙丘：帝国起义</a></li>
          <li><a href="ascension.html">🃏 创升纪元</a></li>`.trim();

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《沙丘：帝国起义》(Dune: Imperium – Uprising) 官方规则书全文翻译：独立续作，新增间谍、沙虫、屏障墙与目标牌，可与世界启动包/CHOAM 模块和《沙丘：帝国》全系列合玩。附 CHOAM 模块与图标指南。">
  <title>沙丘：帝国起义 · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🪱</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="uprising">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">沙丘：帝国起义（Dune: Imperium – Uprising）</span>
  </header>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <nav class="toc" aria-label="本页目录">
        <div class="toc-title">本页目录</div>
        <ul id="toc-list"></ul>
      </nav>
      <nav aria-label="全部游戏">
        <div class="toc-title">全部游戏</div>
        <ul>
${SIDEBAR_GAMES}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🪱 沙丘：帝国起义</h1>
          <p class="game-sub">Dune: Imperium – Uprising · 设计：Paul Dennen · Dire Wolf Digital 出版（2023）· 《沙丘：帝国》独立续作，可单独游玩或与其合玩</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人（可扩展至 6 人）</span>
            <span class="meta-chip">📖 官方规则书全文翻译（英文原版）</span>
            <span class="meta-chip">🗺️ 正文 20 页 · 含 CHOAM 模块与图标指南</span>
          </div>
        </header>

${body}

        <footer class="source-note">
<p>来源：<a href="https://bghub.org/r/duneimperiumuprising.pdf" target="_blank" rel="noopener">Dune: Imperium – Uprising Rulebook（官方英文规则书 PDF，2023，bghub.org 转载）</a> · Dire Wolf Digital · 规则内容归 Dire Wolf Digital 及版权方所有，翻译仅供个人学习查阅。</p>
</footer>
      </article>
    </main>
  </div>

  <button class="to-top" aria-label="返回顶部">↑</button>
  <script src="../assets/js/main.js"></script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`written: ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
