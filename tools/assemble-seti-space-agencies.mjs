// 把 content/_transcripts/seti-space-agencies/ 下的 8 页转录片段装配为 games/seti-space-agencies.html
// 《地外文明：太空机构》(SETI: Space Agencies) 官方中文规则书：封面 + 印页 2–8
// 用法: node tools/assemble-seti-space-agencies.mjs && node tools/wire-seo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "seti-space-agencies");
const OUT = path.join(ROOT, "games", "seti-space-agencies.html");
const IMG = "../assets/img/seti-space-agencies";

// 每页插图题注
const CAPTIONS = {
  1: "封面 · 地外文明 SETI: Search for Extraterrestrial Intelligence · 太空机构 · 规则说明书",
  2: "组件 · 扩展组件（异星实验室板块 · 未来时域指示物 · 11 个非对称机构 · 快速启动牌 · 项目牌 · 信号指示物） · 单人游戏组件",
  3: "新外星物种（阿尔科西星人 · 象形星人 · 阿米巴 · 备用指示物） · 如何使用本扩展",
  4: "使用机构进行游戏 · 设置 · 首次游戏",
  5: "快速启动牌 · 机构卡面解剖（起始资源与效果 · 被动能力 · 每轮限用一次能力 · 增加收入 · 收入） · 1-2 人游戏调整 · 中立信号",
  6: "使用机构进行单人游戏 · 设置（起始行动牌堆 / 宣传 / 目标）",
  7: "单人长期目标板块 · 当高级行动牌用完时 · Promo 卡牌（太空机构）",
  8: "信号指示物 · 使用信号指示物 · 常见问题解答（5 轮游戏 · 不用机构 · 氦核议会与宇宙战略集团 · 未来时域研究所）",
};

// 装配时整节剥离的转录员注记小节（要点已并入页首整理说明）
const STRIP_HEAD = /^#{2,4} (疑似排印问题|组件数量加和自检|数量加和自检|其他说明|自检注)/;
// 降为四级标题（保留内容、不进目录）的小节
const DEMOTE_HEAD = /^(示例卡牌文字|示例卡 |示例图|图注|图$|图（)/;
// 整行剥离的杂项（印页/页眉为版式描述,题注已含章节信息;片首「# 规则书第 N 页」为转录文件题头）
const STRIP_LINE = [/^印页[:：]/, /^页眉[:：]/, /^页首横幅章节名[:：]/, /^> ?转录说明[:：]/, /^转录说明[:：]/, /^# 规则书第 \d+ 页/, /^-{3,}$/];

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function preprocess(text) {
  const lines = text.split("\n");
  const out = [];
  let stripLevel = 0; // 0 = 不在剥离区
  for (const line of lines) {
    const hm = line.match(/^(#{1,6}) /);
    if (hm) {
      const level = hm[1].length;
      if (stripLevel && level <= stripLevel) stripLevel = 0; // 剥离区结束
      if (!stripLevel && STRIP_HEAD.test(line)) { stripLevel = level; continue; }
      if (stripLevel) continue;
      if (/^# 规则书第 \d+ 页/.test(line)) continue; // 转录文件题头,不进正文
      let t = line;
      if (DEMOTE_HEAD.test(t.replace(/^#+ /, ""))) t = t.replace(/^#+ /, "#### ");
      // 标题尾随的〔…〕图注说明移出标题,避免污染目录
      const bm = t.match(/^(#{1,6} [^〔]*?)\s*〔(.+?)〕\s*$/);
      if (bm) {
        out.push(bm[1]);
        out.push("");
        out.push(`〔${bm[2]}〕`);
        continue;
      }
      out.push(t);
      continue;
    }
    if (stripLevel) continue;
    if (STRIP_LINE.some(re => re.test(line))) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/〔(图[:：]|图 |转录注[:：]|图标[:：])([^〕]*)〕/g, "<em>〔$1$2〕</em>");
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
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!/^[\s:|-]+$/.test(lines[i])) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push('<div class="table-wrap">\n<table>\n<thead>\n<tr>' + head.map(c => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n"
        + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("\n") + "</tr>").join("\n")
        + "\n</table>\n</div>");
      continue;
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
    if (/^\s*\d+[.、)]\s+/.test(line)) {
      // 收集列表项(条目间允许空行);按字面序号回落处切分,保证编号与原书一致
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)[.、)]\s+(.*)$/);
        if (m) { items.push({ num: Number(m[1]), text: m[2] }); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*\d+[.、)]\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      const runs = [];
      for (const it of items) {
        const last = runs[runs.length - 1];
        if (!last || it.num <= last[last.length - 1].num) runs.push([it]);
        else last.push(it);
      }
      out.push(runs.map(run => {
        const start = run[0].num !== 1 ? ` start="${run[0].num}"` : "";
        return `<ol${start}>\n` + run.map(it => `  <li>${inline(it.text)}</li>`).join("\n") + `\n</ol>`;
      }).join("\n"));
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
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="地外文明：太空机构规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 8; n++) frags[n] = preprocess(readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/bOqAtW6UeCSGyJqAyBPm4Q" target="_blank" rel="noopener">「乐智源桌游工作室」星空循迹 太空机构[SETI Space Agencies]</a>一文发布的《地外文明：太空机构》(SETI: Space Agencies，《地外文明》，即站内<a href="seti.html">《SETI：寻找外星人》</a>同款游戏的官方中文版，Tomáš Holek 设计，CGE 出版) 官方中文规则书扫描件。扩展全书 8 页（封面 + 印页 2–8）逐页全文转录（封面、组件、新外星物种、使用机构进行游戏、快速启动牌/机构卡面解剖与 1-2 人游戏调整、使用机构进行单人游戏、单人长期目标与 Promo 卡牌、信号指示物与常见问题解答），原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 CGE 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：〔图标：……〕表示此处为印刷图标/图形，非文字；〔图 …〕说明为整理所拟。组件清单已逐项核对加和——P.2 扩展组件+单人组件明示数量合计 95 件，P.3 三个新外星物种明示数量合计 90 件（阿尔科西星人 23 + 象形星人 50 + 阿米巴 17），全书明示数量合计 185 件。扫描件模糊处（示例卡卡名、卡面风味小字等）均如实标〔?〕并说明，未作推测补全；P.2「3 个单人长期目标板块」的物品编号 #6 被公众号水印遮压，据本页物品编号连续递推补定。P.2/P.8 页底便签（扩展卡牌标识提示、临龙桌游 Q 群信息）与全页「公众号·乐智源桌游工作室」水印为扫描件所含叠加内容，非规则书正文，照录备考。原书章节横幅「1 - 2 人游戏调整」「Promo 卡 牌」等字间空格照录。</small></p>
</blockquote>`);

for (let n = 1; n <= 8; n++) {
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
  <meta name="description" content="《地外文明：太空机构》（SETI: Space Agencies，《地外文明》/SETI 官方中文版扩展）中文规则书全文转录：11 个非对称机构与专属收入、21 张快速启动牌、42 张新项目牌、3 个新外星物种（阿尔科西星人/象形星人/阿米巴）、信号指示物、1-2 人游戏调整、单人长期目标与 Promo 卡牌，附 FAQ，规则书扫描图随文嵌入，需配合基础游戏。">
  <title>地外文明：太空机构 (SETI: Space Agencies) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🚀</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="setisa">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">地外文明：太空机构</span>
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
${SIDEBAR_GAMES.map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🚀 地外文明：太空机构</h1>
          <p class="game-sub">SETI: Space Agencies · 《地外文明》扩展 · 设计：Tomáš Holek · CGE 出版 · 1–4 人（官方中文版规则书全文转录，需配合基础游戏）</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">🧩 《地外文明》扩展</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
            <span class="meta-chip">🏛️ 11 个非对称机构</span>
            <span class="meta-chip">📡 信号指示物 · 新外星物种</span>
            <span class="meta-chip">🤖 含单人规则与 FAQ</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/bOqAtW6UeCSGyJqAyBPm4Q" target="_blank" rel="noopener">「乐智源桌游工作室」星空循迹 太空机构[SETI Space Agencies]</a>（《地外文明：太空机构》官方中文规则书扫描件）· 规则内容归 CGE 及版权方所有，转录仅供个人学习查阅。</p>
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
