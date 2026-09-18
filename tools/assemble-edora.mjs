// 把 content/_transcripts/druids-of-edora/ 下的转录片段装配为 games/druids-of-edora.html
// 用法: node tools/assemble-edora.mjs
// 全书 12 页 + 双面规则参考表(魔法药剂/石碑)共 14 个扫描单元,已全部收录。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "druids-of-edora");
const OUT = path.join(ROOT, "games", "druids-of-edora.html");
const IMG = "../assets/img/druids-of-edora";
const PAGE_COUNT = 14;

// 每页插图题注
const CAPTIONS = {
  1: "P.1 封面 · 游戏目标 · 游戏配件 · 每位玩家分别有（中文翻译&排版：陈斌华）",
  2: "P.2 游戏设置（步骤 1–9）：版图框架与行动区域人数表 · 概览版图 · 神谕遗址与石碑 · 巨石墓 · 宝石 · 药剂 · 公共供应堆",
  3: "P.3 每位玩家（步骤 10 A–K）：大小型玩家面板 · 13 颗骰子分个人/公共储备 · 镰刀 · 声望 · 石碑 · 药草 · 补给袋",
  4: "P.4 德鲁伊大师（起始玩家与初始摆放） · 游戏玩法总览 · 步骤 1 移动 · 步骤 2 放置骰子（含楼梯不可转弯注意）",
  5: "P.5 步骤 3 竞争 · 步骤 4 执行行动 · 步骤 5 篝火 · 步骤 6 巨石墓（连接奖励 8/6/4） · 步骤 7 药草",
  6: "P.6 行动：拿取补给袋或骰子 · 将知识标记向前移动 · 移动镰刀标记 · 拿取石碑板块 · 采集槲寄生",
  7: "P.7 添加宝石到护符（乘数与去重规则） · 放置立石（累积奖励） · 两则举例",
  8: "P.8 放置符文石（点数 −1 / ×1×2×3 两类） · 奖励 6 种一览 · 「陷入困境的德鲁伊」",
  9: "P.9 药草：释放规则 · 激活/未激活 · 7 种药草增益（深绿底 4 种须亲自执行行动）",
  10: "P.10 药草（续）：林跃 · 符文石 · 篝火 · 声望 3→5 · 石碑药草 · 篝火（16 个火坑的围住与覆盖）",
  11: "P.11 游戏结束与终局计分 5 步：剩余物资 · 镰刀标记 · 石碑 · 护符 · 神殿（知识条乘数）",
  12: "P.12 玩法变体 4 则 · 制作人员（Stefan Feld / alea / Ravensburger）",
  13: "规则参考表·正面「中文 魔法药剂」：炼制规则与 1–5 槲寄生费用全部药剂效果",
  14: "规则参考表·背面「魔法药剂（续）+ 石碑」：5–6 槲寄生药剂 · 15 块石碑计分条件一览",
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
  t = t.replace(/^〔页脚页码：\d+〕\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="埃多拉的德鲁伊规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= PAGE_COUNT; n++) frags[n] = preprocess(n, readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自玩家社群流传的《埃多拉的德鲁伊》(The Druids of Edora,Stefan Feld 设计,alea / Ravensburger AG 出版,2025)中文规则书扫描件(中文翻译 &amp; 排版:陈斌华,译笔与<a href="speakeasy.html" target="_blank" rel="noopener">《地下酒吧》</a>同源),扫描图由网友直接提供。全书 12 页(封面 + P.2–P.12)与双面规则参考表(「中文 魔法药剂」/「魔法药剂(续) + 石碑」)共 14 幅扫描图逐页全文转录,原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 alea、Ravensburger AG 及版权方所有,转录仅供个人学习查阅。</p>
<p><small>整理说明:〔三螺旋〕为声望点数图标,〔知识结〕〔槲寄生〕等为印刷图标标记;〔图 …〕〔右栏摘要〕〔费用:N 槲寄生〕〔石碑面值 N〕说明为整理所拟(原书每步骤右侧附摘要卡,已并入各步骤之后;规则参考表石碑条目中两块骰子图形石碑未印面值数字,照录)。原书排印问题照录:「补给袋品」(封面与规则参考表,他处作「补给袋」)、「请确保每个 24 个神殿」(P.2,疑衍「每个」)、「记录记录条」(P.6 镰刀行动,衍「记录」)、「声望点」与「声望点数」混用、「15 点声望(3x5),而非九点」(P.10,汉字「九」与他处阿拉伯数字混用)、「并重新分配 2 点声望」(参考表 6 槲寄生药剂,语义存疑照录)。</small></p>
</blockquote>`);
parts.push(mdToHtml(frags[1]));

for (let n = 2; n <= PAGE_COUNT; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

// BGG 评分（浏览器实测 boardgamegeek.com/boardgame/440007，2026-09）
const BGG = { id: "440007", rating: "7.8", rank: "1098", weight: "3.14", users: "2300" };
const chip = `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${BGG.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${BGG.rating}，排名 #${BGG.rank}，权重/复杂度 ${BGG.weight}/5（1 轻松 ~ 5 重度），${BGG.users}人评分。点击查看原页面">⭐ BGG ${BGG.rating} · 排名 #${BGG.rank} · 权重 ${BGG.weight}/5 · ${BGG.users}人评分</a>`;

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
  ["ark-nova-marine-worlds.html", "🐙 方舟动物园：海洋世界"],
  ["speakeasy.html", "🎷 地下酒吧"],
  ["power-grid.html", "⚡ 电力公司"],
  ["seti.html", "🛰️ SETI：寻找外星人"],
  ["endeavor-deep-sea.html", "🌊 奋进号：深海"],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《埃多拉的德鲁伊》（The Druids of Edora）中文规则书全文转录：2–4 人骰子放置游戏，Stefan Feld 设计，在魔法森林的神殿间移动掷骰、竖立符文石与立石、炼制魔法药剂、释放药草增益、连接巨石墓、围住火坑，终局五步计分与15块石碑目标，全书 12 页+双面规则参考表，扫描图随文嵌入。">
  <title>埃多拉的德鲁伊 (The Druids of Edora) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🌲</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="edora" data-game-key="druids-of-edora">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">埃多拉的德鲁伊</span>
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
          <h1 class="game-title">🌲 埃多拉的德鲁伊</h1>
          <p class="game-sub">The Druids of Edora · 设计：Stefan Feld · alea / Ravensburger AG 出版（2025）· 2–4 人（中文规则书全文转录·全书 12 页+双面规则参考表）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 2–4 人</span>
            <span class="meta-chip">⏱️ 60–90 分钟</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
            <span class="meta-chip">🎲 骰子放置 · 神殿仪式</span>
            <span class="meta-chip">🪨 巨石墓连接 · 符文石</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：玩家社群流传的《埃多拉的德鲁伊》(The Druids of Edora) 中文规则书扫描件（翻译 &amp; 排版：陈斌华），扫描图由网友提供 · 规则内容归 alea、Ravensburger AG 及版权方所有，转录仅供个人学习查阅。</p>
</footer>
      </article>
    </main>
  </div>

  <button class="to-top" aria-label="返回顶部">↑</button>
  <script src="../assets/js/main.js"></script>
  <script src="../assets/js/account.js"></script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`已生成 ${OUT}（${PAGE_COUNT} 页扫描图随文嵌入）`);
