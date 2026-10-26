// 把 content/_transcripts/gaiaproject-lost-fleet/ 下的 16 页转录片段装配为 games/gaiaproject-lost-fleet.html
// 《盖亚计划:失落的舰队》(Gaia Project: The Lost Fleet) 官方中文扩展规则书:封面 + 印页 2-16
// 用法: node tools/assemble-gaiaproject-lost-fleet.mjs && node tools/wire-seo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "gaiaproject-lost-fleet");
const OUT = path.join(ROOT, "games", "gaiaproject-lost-fleet.html");
const IMG = "../assets/img/gaiaproject-lost-fleet";

// 每页插图题注(对应原书印页)
const CAPTIONS = {
  1: "封面 · 蓋亞計劃:失落的艦隊 · 背景故事",
  2: "遊戲配件(上) · 擴展組件",
  3: "用於擴展的配件(智腦/新玩家顏色) · 簡介 · 初次加入本擴展前",
  4: "遊戲設置變更 · 可變版圖佈局(2 人/3 人)",
  5: "星際板塊 · 4 人遊戲設置 · 面板設置變更(計分面板)",
  6: "研究面板 · 失落艦隊的飛船",
  7: "四艘飛船背景(黃昏號/反叛號/重塑火星號/日蝕號) · 挑選你的種族",
  8: "改造面板/探索面板設置 · 放置初始建築",
  9: "新的行動 11) 探索 · 12) 調查一個聖器",
  10: "基礎遊戲行動的變更(建造/升級/聯邦/能量行動)",
  11: "特殊行動/免費行動變更 · 版權 · 智腦單人遊戲規則的變更(設置)",
  12: "智腦行動的變更 · 難度等級 · 致謝",
  13: "附錄 I 新的種族(焊修智械/莫維茲星人/太空巨人/暗黑星人) · 新的行動格",
  14: "新的行動格(續) · 附錄 III 新的回合助推器 · 附錄 IV 新的計分板塊",
  15: "新的最終計分板塊 · 附錄 V-VII(新科技/新聯邦標記/聖器)",
  16: "全部十八個種族概覽",
};

const STRIP_LINE = [/^# 规则书第 \d+ 页/, /^-{3,}$/];

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function preprocess(text) {
  return text
    .split("\n")
    .filter((line) => !STRIP_LINE.some((re) => re.test(line.trim())))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/〔(图[:：]|图 |侧注[:：]|示例|图注[:：]|版權頁)([^〕]*)〕/g, "<em>〔$1$2〕</em>");
  return out;
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^#{1,4} /.test(line)) {
      const m = line.match(/^(#+) /);
      const level = Math.max(m[1].length, 2);
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ""))}</h${level}>`);
      i++; continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^[\s:|-]+$/.test(lines[i])) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        }
        i++;
      }
      const [head, ...body] = rows;
      out.push('<div class="table-wrap">\n<table>\n<thead>\n<tr>' + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n"
        + body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("\n")
        + "\n</table>\n</div>");
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        if (/^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*[-*]\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      out.push("<ul>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "\n</ul>");
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        if (/^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*\d+\.\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      out.push("<ol>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "\n</ol>");
      continue;
    }
    out.push(`<p>${inline(line.trim())}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="盖亚计划:失落的舰队规则书第 ${n} 页扫描图:${cap}" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 16; n++) frags[n] = preprocess(readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247533486&idx=1&sn=fff7450bf520206615d74be6d5a0cef1" target="_blank" rel="noopener">「桌游怎么玩」【桌游规则】盖亚计划:失落的舰队</a>一文发布的《盖亚计划:失落的舰队》(Gaia Project: The Lost Fleet,Helge Ostertag &amp; Jens Drogemüller 设计,Feuerland Spiele 2024 出版)官方中文扩展规则书扫描件(规则来源:斯虹;中文翻译:周天易)。扩展全书 16 页逐页全文转录(封面背景故事、扩展配件、简介与初次加入本扩展前的准备、可变版图布局 2/3/4 人设置、面板设置变更、失落舰队的四艘飞船、改造面板与探索面板、放置初始建筑、新行动 11) 探索与 12) 调查一个圣器、基础游戏行动的变更、特殊行动/免费行动变更、智脑单人游戏规则变更与难度等级、附录:4 个新种族(焊修智械/莫维兹星人/太空巨人/暗黑星人)/新行动格/新回合助推器/新计分板块/新科技/新联邦标记/圣器、全部十八个种族概览),原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。需配合基础游戏《盖亚计划》(站内<a href="bga/gaiaproject.html">官方中文规则书转录页</a>)使用。规则内容归版权方所有,转录仅供个人学习查阅。</p>
<p><small>整理说明:扫描页经双遍 OCR 转录并逐项复核。基础版(游人码头繁体版)与扩展版(简体版,另一翻译团队)用语存在差异,照录两版原文:如盖亚改造单元/盖亚改造机、矿物基地/矿产基地等。种族名以第 16 页十八种族总览(高分辨率页,置信度高)为准:4 个新种族为焊修智械、莫维兹星人、太空巨人、暗黑星人;四艘失落舰队飞船为黄昏号、反叛号、重塑火星号、日蚀号。第 12 页难度等级表「王智腦 10 分(沒有變化)」数值照录存疑;个别无法确认的字以〔?〕标注,〔图:〕〔侧注〕〔示例〕〔图注〕为版面插图/旁注/图注占位说明。</small></p>
</blockquote>`);

for (let n = 1; n <= 16; n++) {
  if (n > 1) parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

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
  ["tulip-bubble.html", "🌷 郁金香泡沫"],
  ["trajan.html", "🦅 图拉真"],
  ["galileo-galilei.html", "🔭 伽利略：伽利莱"],
  ["orloj.html", "🕰️ 奥洛伊：布拉格天文钟"],
  ["food-chain-magnate.html", "🍔 快餐连锁大亨"],
  ["clank-catacombs.html", "🐉 CLANK! 地下墓穴"],
  ["clank-catacombs-underworld.html", "💀 CLANK! 地下墓穴:地下世界"],
  ["clank-adventuring-party.html", "🗡️ CLANK! 冒险队"],
  ["ark-nova-marine-worlds.html", "🐙 方舟动物园：海洋世界"],
  ["arnak-expedition-leaders.html", "🗿 阿纳克遗迹:探险队长"],
  ["speakeasy.html", "🎷 地下酒吧"],
  ["power-grid.html", "⚡ 电力公司"],
  ["seti.html", "🛰️ SETI：寻找外星人"],
  ["seti-space-agencies.html", "🚀 地外文明：太空机构"],
  ["gaiaproject-lost-fleet.html", "🛸 盖亚计划:失落的舰队"],
  ["endeavor-deep-sea.html", "🌊 奋进号：深海"],
  ["druids-of-edora.html", "🌲 埃多拉的德鲁伊"],
  ["grand-austria-hotel.html", "🏨 奥地利大饭店"],
  ["the-message.html", "🕵️ 风声再临"],
  ["gwt-new-zealand.html", "🐑 大西部开拓者:新西兰"],
  ["fields-of-arle.html", "🌾 阿勒農場"],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《盖亚计划:失落的舰队》(Gaia Project: The Lost Fleet)官方中文扩展规则书全文转录:8 个深空星域与 30 个星际板块、四艘失落舰队飞船(黄昏号/反叛号/重塑火星号/日蚀号)与新行动探索/调查圣器、2 种新星球类型(小行星/原行星)、4 个新种族(焊修智械/莫维兹星人/太空巨人/暗黑星人)、新回合助推器/计分板块/科技/联邦标记、智脑单人规则变更与难度等级、十八个种族概览,需配合基础游戏。">
  <title>盖亚计划:失落的舰队 (Gaia Project: The Lost Fleet) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🛸</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="gaialost">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">盖亚计划:失落的舰队</span>
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
${SIDEBAR_GAMES.filter(([href]) => href !== "gaiaproject-lost-fleet.html").map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🛸 盖亚计划:失落的舰队</h1>
          <p class="game-sub">Gaia Project: The Lost Fleet · 《盖亚计划》扩展 · 设计:Helge Ostertag &amp; Jens Drogemüller · Feuerland Spiele 出版 · 1–4 人(官方中文扩展规则书全文转录,需配合基础游戏)</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">🧩 《盖亚计划》扩展</span>
            <span class="meta-chip">📖 中文扩展规则书全文转录</span>
            <span class="meta-chip">🛸 四艘失落舰队飞船</span>
            <span class="meta-chip">🌑 小行星/原行星 · 4 个新种族</span>
            <span class="meta-chip">🤖 含智脑单人规则变更</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源:微信公众号 <a href="https://mp.weixin.qq.com/s?__biz=MzIwMjg2MzMyNg==&mid=2247533486&idx=1&sn=fff7450bf520206615d74be6d5a0cef1" target="_blank" rel="noopener">「桌游怎么玩」【桌游规则】盖亚计划:失落的舰队</a>(《盖亚计划:失落的舰队》官方中文扩展规则书扫描件,规则来源:斯虹)· 基础游戏规则见 <a href="bga/gaiaproject.html">《盖亚计划》官方中文规则书转录页</a> · 规则内容归 Feuerland Spiele 及版权方所有,转录仅供个人学习查阅。</p>
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
