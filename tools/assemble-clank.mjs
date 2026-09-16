// 把 content/_transcripts/clank-catacombs/ 下的 17 页转录片段装配为 games/clank-catacombs.html
// 用法: node tools/assemble-clank.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "clank-catacombs");
const OUT = path.join(ROOT, "games", "clank-catacombs.html");
const IMG = "../assets/img/clank-catacombs";

// 每页插图题注
const CAPTIONS = {
  1: "规则书封面 · CLANK! CATACOMBS 地下墓穴（Dire Wolf 出品，官方中文版）",
  2: "P.2 游戏组件（面板 / 板块 / 方块 / 牌库 / 参考页）",
  3: "P.3 组件图鉴（商店 / 神器 / 秘宝 / 囚犯 / 金币 / 开锁器）· 踏进地城",
  4: "P.4 游戏设置（A–D 步骤）· 布局总览",
  5: "P.5 设置步骤 E–H（储备牌区 / 玩家设置 / 初始 Clank!）· 基础版组件变体设置",
  6: "P.6 进行回合（技巧 / 剑 / 靴子 · 金币 / Clank! / 抽牌 · 出牌示例）",
  7: "P.7 行动：购买卡牌 · 使用装置 · 打野 · 移动",
  8: "P.8 行动：商店购物 · 入手神器 · 拾获宝箱 / 典籍 / 牢房",
  9: "P.9 发现新板块（放置规则图示）",
  10: "P.10 板块元素（神器 / 墓穴 / 水晶洞窟 / 闹鬼 / 上锁奖励 / 商店 / 传送门 / 奖励）",
  11: "P.11 指路神坛 · 卡牌效果（获得 / 到达 / 危险 / 弃牌 / 每名玩家 / 传送 / 废弃）",
  12: "P.12 回合结束与巨龙攻击 · 生命和伤害（幽灵方块）",
  13: "P.13 回合范例（绿色玩家完整回合）",
  14: "P.14 游戏结束和终局计分（逃脱 / 被淘汰 / 深处）",
  15: "P.15 地下墓穴派对（5–6 人派对扩展规则）",
  16: "P.16 标记指南：囚犯（13 种囚犯标记）",
  17: "P.17 组件图鉴：大型秘宝 / 商品 / 小型秘宝 / 圣猴神像",
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
  // 去 H1 页眉行、页码行、排版说明行
  t = t.replace(/^# .*$/gm, "");
  t = t.replace(/^（页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（页面右下角页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（封面页）\s*$/gm, "");
  t = t.replace(/^（本页无大标题[^）]*）\s*$/gm, "");
  t = t.replace(/^（以下为左右双栏排版。?）\s*$/gm, "");
  t = t.replace(/^（本节为左右两栏排版[^）]*）\s*$/gm, "");
  t = t.replace(/^（本节为一个带边框[^）]*）\s*$/gm, "");
  t = t.replace(/^（本页为组件图鉴页[^）]*）\s*$/gm, "");
  t = t.replace(/^（页顶绿色缎带标题：[^）]*）\s*$/gm, "");

  // 标题规整（原书为图版分区排版,小节标题为整理所拟）
  t = t.replace(/^## 组件图（带名称与数量）\s*$/gm, "## 组件图鉴");
  if (n === 5) {
    t = t.replace(/^## E\s*$/gm, "## 步骤 E：储备牌区");
    t = t.replace(/^## F\s*$/gm, "## 步骤 F：选色与棋子");
    t = t.replace(/^## G\s*$/gm, "## 步骤 G：个人供应堆");
    t = t.replace(/^## H\s*$/gm, "## 步骤 H：首动玩家与初始 Clank!");
    t = t.replace(/^## 左下角图示（标 E、F、D）\s*$/gm, "### 布局图示");
    t = t.replace(/^## F, G\s*$/gm, "### 供应堆摆放");
    t = t.replace(/^## 底部说明框（带 CLANK! 标志）\s*$/gm, "### 变体设置说明框");
  }
  if (n === 6) {
    t = t.replace(/^## （卡牌效果与出牌顺序示例，无小节标题）\s*$/gm, "### 卡牌效果与出牌顺序示例");
  }
  if (n === 7 || n === 8) {
    t = t.replace(/^## （页底提示框）\s*$/gm, "### Clank! 提示");
  }
  if (n === 15) {
    t = t.replace(/^## 地下墓穴派对（页首横幅标题）\s*$/gm, "## 地下墓穴派对（5–6 人扩展）");
  }
  if (n === 16) {
    t = t.replace(/^## 标记指南（横幅标题）\s*$/gm, "## 标记指南");
    t = t.replace(/^### /gm, "#### ");
    t = t.replace(/^## 囚犯\s*$/gm, "### 囚犯");
  }
  if (n === 17) {
    t = t.replace(/^## 大型秘宝（左上框）\s*$/gm, "## 大型秘宝");
    t = t.replace(/^## 商品（左下框）\s*$/gm, "## 商品");
    t = t.replace(/^## 小型秘宝（右栏长框）\s*$/gm, "## 小型秘宝");
    t = t.replace(/^## 圣猴神像（右下框）\s*$/gm, "## 圣猴神像");
    t = t.replace(/^### /gm, "#### ");
  }
  // P.3 组件图鉴:短行组件名转为列表项
  if (n === 3) {
    t = t.replace(/^(?!〔)(?!#)(?!-)(.{1,14})$/gm, (m, s) => s.trim() ? `- ${s.trim()}` : m);
  }
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  // 〔图:…〕标记 → 行内斜体注
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
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="CLANK!地下墓穴规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 17; n++) frags[n] = preprocess(n, readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/eFYIoamsySitThPcMxRVjQ" target="_blank" rel="noopener">「无忧桌游」《CLANK 地下墓穴》</a>发布的《Clank! Catacombs》官方中文规则书（全书 17 页扫描含封面），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Dire Wolf、Renegade Game Studios 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：原书官译用语（「打野」「踏进地城」「指路神坛」「圣猴神像」「开锁器」「巨龙盲抽袋」「技巧/剑/靴子」等）照录。原书用词不一处均照录：「囚犯/囚徒」混用（P.4 印「囚徒」、P.8 并见两词），「圣猴神龛（P.4）/圣猴神庙（P.15、P.17）」并存；P.4「将7神器」疑缺量词，P.10「22个深处板块中 的4块」空格，P.13「第2个绿色方块，因此绿色玩家受到1点伤害」句，P.16 打折券括注「（例如暴动，战士，法外狂徒）」，均为原书排印如此。P.16「女巫」「战士」条目各有一处被污迹遮盖（依稀笔画疑为「游戏」「战」，已照实标注）。小节标题与〔图:…〕说明为整理所拟，原书为图版分区排版；扫描集共 17 图（封面＋正文 P.2–15＋两页无页码图鉴）。</small></p>
</blockquote>`);

for (let n = 2; n <= 17; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

// BGG 评分（浏览器实测 boardgamegeek.com/boardgame/365717,2026-09）
const BGG = { id: "365717", rating: "8.2", rank: "48", weight: "2.50", users: "15000" };
const chip = BGG
  ? `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${BGG.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${BGG.rating}，排名 #${BGG.rank}，权重/复杂度 ${BGG.weight}/5（1 轻松 ~ 5 重度），${BGG.users}人评分。点击查看原页面">⭐ BGG ${BGG.rating} · 排名 #${BGG.rank} · 权重 ${BGG.weight}/5 · ${BGG.users}人评分</a>`
  : "";

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
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《CLANK! 地下墓穴》（Clank! Catacombs）官方中文规则书全文转录：2–4 人无版图牌库构筑冒险，摆放板块生成专属地城，夺取神器逃出巨龙墓穴，含 5–6 人派对扩展规则与囚犯标记图鉴，规则书扫描图随文嵌入。">
  <title>CLANK! 地下墓穴 · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🐉</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="clank">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">CLANK! 地下墓穴（Clank! Catacombs）</span>
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
          <h1 class="game-title">🐉 CLANK! 地下墓穴</h1>
          <p class="game-sub">Clank! Catacombs · 设计：Paul Dennen · Dire Wolf 出品（官方中文规则书全文转录）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 2–4 人（派对扩展 5–6 人）</span>
            <span class="meta-chip">⏱️ 30–60 分钟</span>
            <span class="meta-chip">📖 官方中文规则书全文转录</span>
            <span class="meta-chip">🐉 牌库构筑地下城冒险</span>
            <span class="meta-chip">🧩 无版图·板块拼放</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/eFYIoamsySitThPcMxRVjQ" target="_blank" rel="noopener">「无忧桌游」《CLANK 地下墓穴》</a>（《Clank! Catacombs》官方中文规则书）· 规则内容归 Dire Wolf、Renegade Game Studios 及版权方所有，转录仅供个人学习查阅。</p>
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
