// 把 content/_transcripts/ark-nova-marine/ 下的 16 页转录片段装配为 games/ark-nova-marine-worlds.html
// 用法: node tools/assemble-arkmarine.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "ark-nova-marine");
const OUT = path.join(ROOT, "games", "ark-nova-marine-worlds.html");
const IMG = "../assets/img/ark-nova-marine-worlds";

// 每页插图题注（扫描图 9–16 为书内《术语表》/《图标概览》,书内页码 1–8）
const CAPTIONS = {
  1: "扩展规则书第 1 页 · 游戏介绍 · 游戏配件（81 张卡牌 +38 张替换卡牌）",
  2: "扩展规则书第 2 页 · 游戏设置前的准备（18 张被替换卡牌清单） · 游戏设置变动",
  3: "扩展规则书第 3 页 · 新的动物类目：海洋动物 · 海洋动物的安置",
  4: "扩展规则书第 4 页 · 安置可能（续） · 珊瑚住客 · 海浪图标",
  5: "扩展规则书第 5 页 · 三个示例：海洋馆 / 珊瑚住客 / 海浪图标",
  6: "扩展规则书第 6 页 · 全新的大学 · 获得示例",
  7: "扩展规则书第 7 页 · 具有差异的行动卡牌：布局详解与四张变体示例",
  8: "扩展规则书第 8 页 · 轮抽变体行动卡牌 · 声望记录条上的奖励板块 · 单人游戏",
  9: "术语表 P.1 · 引言 · 全新的奖励板块 · 致谢名单与版权（Version 1.0）",
  10: "术语表 P.2 · 行动卡牌详解：动物 / 协会",
  11: "术语表 P.3 · 行动卡牌详解：协会(续) / 建造 / 卡牌",
  12: "术语表 P.4 · 行动卡牌详解：赞助商 · 保护项目详解 · 终局计分卡牌详解(012–017)",
  13: "术语表 P.5 · 动物能力详解（14 项能力）",
  14: "术语表 P.6 · 赞助商卡牌详解（265–272）",
  15: "术语表 P.7 · 协会卡牌详解（273–280）",
  16: "术语表 P.8 · 图标概览",
};

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function normalizePunct(t) {
  t = t.replace(new RegExp(`([${CJK}）】」”〕]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]):`, "g"), "$1：");
  t = t.replace(new RegExp(`([${CJK}）】」”〕])\\(`, "g"), "$1（");
  t = t.replace(new RegExp(`\\)([${CJK}（【“「〔])`, "g"), "）$1");
  return t;
}

function preprocess(n, text) {
  let t = text;
  t = t.replace(/^# 扩展规则书第.*$/gm, "");
  t = t.replace(/^# 海洋世界\s*$/gm, "");
  t = t.replace(/^（页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（书内印刷页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（页脚[^）]*）\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  // 部分纯排版说明行照删
  t = t.replace(/^（页首为承接上页的设置条目）\s*$/gm, "");
  t = t.replace(/^（页首承接上页[^）]*）\s*$/gm, "");
  t = t.replace(/^（本页无大标题[^）]*）\s*$/gm, "");
  t = t.replace(/^（本页为两栏表格[^）]*）\s*$/gm, "");
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(/〔图[:：]([^〕]*)〕/g, "<em>〔图 $1〕</em>");
  return out;
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^#{2,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ""))}</h${level}>`);
      i++; continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push("<blockquote>\n" + mdToHtml(quote.join("\n")) + "\n</blockquote>");
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      out.push("<ul>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "\n</ul>");
      continue;
    }
    let text = line.trim();
    out.push(`<p>${inline(text)}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `扩展规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="方舟动物园海洋世界扩展规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/CEQf5aa0KbUTwRtjAgg_QA" target="_blank" rel="noopener">「桌游怎么玩」《方舟动物园，海洋世界，扩展，术语表【桌游规则】》</a>发布的《方舟动物园：海洋世界》(Ark Nova: Marine Worlds) 扩展官方中文规则书（游人码头简体中文版，©2023 Feuerland，全书 16 页扫描），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Feuerland Verlagsgesellschaft、游人码头及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：本扩展规则书共 8 页正文（扫描图 1–8），随书另附《术语表/图标概览》8 页（扫描图 9–16，对应书内页码 1–8），一并全文收录。配件总数经加和自洽：81 张卡牌 = 动物园 54 + 终局计分 6 + 基础保护项目 1 + 变体行动 20；38 张替换卡牌 = 9 + 7 + 2 + 20。原书笔误与生硬句照录：「直到每次休息，仅有一位玩家能获得全新的大学」（疑为"下次休息"），「不再像等级I那面」，「如果这导致你余下的建筑彼此分开是允许的。」（两处），「呈现有灰色背景」等。被基础替换的 18 张卡牌编号（001–262）逐张放大核对无误。游人码头官译用语照录（「海洋馆」「珊瑚住客」「海浪图标」「特形指示物」「泛用大学」「轮抽」等）。〔图 …〕说明为整理所拟。</small></p>
</blockquote>`);

for (let n = 2; n <= 16; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(preprocess(n, readFrag(n))));
}

// BGG 评分（浏览器实测 boardgamegeek.com/boardgame/368966,2026-09;扩展无总排名）
const BGG = { id: "368966", rating: "8.9", weight: "3.86", users: "7651" };
const chip = `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgameexpansion/${BGG.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${BGG.rating}，权重/复杂度 ${BGG.weight}/5（1 轻松 ~ 5 重度），${BGG.users}人评分（扩展条目不设总排名）。点击查看原页面">⭐ BGG ${BGG.rating} · 权重 ${BGG.weight}/5 · ${BGG.users}人评分</a>`;

const SIDEBAR_GAMES = [
  ["7-wonders.html", "🏛️ 七大奇迹"],
  ["brass-birmingham.html", "🏭 工业革命：伯明翰"],
  ["vale-of-eternity.html", "✨ 永恒之谷"],
  ["wingspan.html", "🦜 展翅翱翔"],
  ["pokemon-grove.html", "🌳 宝可梦林地探索"],
  ["puerto-rico.html", "⛵ 波多黎各"],
  ["barcelona.html", "🌸 巴塞罗那"],
  ["dune-imperium.html", "🏜️ 沙丘：帝国"],
  ["dune-imperium-uprising.html", "🪱 沙丘：帝国起义"],
  ["ascension.html", "🃏 创升纪元"],
  ["trajan.html", "🦅 图拉真"],
  ["tulip-bubble.html", "🌷 郁金香泡沫"],
  ["galileo-galilei.html", "🔭 伽利略：伽利莱"],
  ["orloj.html", "🕰️ 奥洛伊：布拉格天文钟"],
  ["food-chain-magnate.html", "🍔 快餐连锁大亨"],
  ["clank-catacombs.html", "🐉 CLANK! 地下墓穴"],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《方舟动物园：海洋世界》（Ark Nova: Marine Worlds）扩展官方中文规则书全文转录：海洋动物与海洋馆、珊瑚住客、海浪图标、全新大学、4 种变体行动卡牌轮抽、灰色奖励板块，随书 8 页术语表与图标概览全文收录，规则书扫描图随文嵌入。">
  <title>方舟动物园：海洋世界 · 扩展规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🐙</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="arkmarine">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">方舟动物园：海洋世界（扩展）</span>
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
          <li><a href="../index.html">🏠 返回首页</a></li>
          <li><a href="../games/bga/arknova.html">🐘 方舟动物园（基础）</a></li>
${SIDEBAR_GAMES.map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🐙 方舟动物园：海洋世界</h1>
          <p class="game-sub">Ark Nova: Marine Worlds · 扩展规则书 · 设计：Mathias Wigge · 游人码头简体中文版（官方中文规则书全文转录，含 8 页术语表）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 1–4 人（含单人模式）</span>
            <span class="meta-chip">⏱️ 需配合基础游戏使用</span>
            <span class="meta-chip">📖 扩展规则书+术语表全文转录</span>
            <span class="meta-chip">🐋 海洋动物与海洋馆</span>
            <span class="meta-chip">🃏 变体行动卡牌轮抽</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/CEQf5aa0KbUTwRtjAgg_QA" target="_blank" rel="noopener">「桌游怎么玩」《方舟动物园，海洋世界，扩展，术语表【桌游规则】》</a>（《Ark Nova: Marine Worlds》扩展官方中文规则书）· 规则内容归 Feuerland Verlagsgesellschaft、游人码头及版权方所有，转录仅供个人学习查阅。基础游戏规则见 <a href="../games/bga/arknova.html">方舟动物园（基础）</a>。</p>
</footer>
      </article>
    </main>
  </div>

  <button class="to-top" aria-label="返回顶部">↑</button>
  <script src="../assets/js/main.js"></script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
