// 把 content/_transcripts/power-grid/ 下的 12 页转录片段装配为 games/power-grid.html
// P.1-8 为基础规则书,P.9-12 为 2008 年中国/韩国地图扩展(封面+规则+两张资源表)
// 用法: node tools/assemble-powergrid.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "power-grid");
const OUT = path.join(ROOT, "games", "power-grid.html");
const IMG = "../assets/img/power-grid";

// 每页插图题注
const CAPTIONS = {
  1: "规则书第 1 页 · 目标 · 游戏组件 · 电厂卡注解 · 电厂卡",
  2: "规则书第 2 页 · 特别电厂 · 准备事项 · 原料市场 · 电厂拍卖市场",
  3: "规则书第 3 页 · 游戏开始（三时期·五回合） · 第一阶段 · 第二阶段：竞拍电厂",
  4: "规则书第 4 页 · 第三阶段：购买原料 · 第四阶段：建设",
  5: "规则书第 5 页 · 建设举例 · 第五阶段：其它事宜 · 报酬表",
  6: "规则书第 6 页 · 补充原料举例 · 游戏各时期（第一/第二/第三时期）",
  7: "规则书第 7 页 · 获胜 · 特殊规则（二至六人） · 初次接触游戏",
  8: "规则书第 8 页 · 在发电阶段补充资源的数量（补充资源表） · 重要规则",
  9: "扩展封面 · 电力网络：中国/韩国 地图扩展（Rio Grande Games，2008）",
  10: "扩展规则 · 韩国地图（南北双市场） · 中国地图（计划经济）",
  11: "扩展规则（续）：竞拍/建设/发电补充资源的特殊规则",
  12: "扩展资源表 · 韩国资源表（N 北韩/S 南韩双行） · 中国资源表",
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
  t = t.replace(/^# 规则书第.*$/gm, "");
  t = t.replace(/^# POWER GRID\s*$/gm, "");
  t = t.replace(/^（页脚[^）]*）\s*$/gm, "");
  t = t.replace(/^〔图[:：] ?页脚[^\n]*$/gm, "");
  t = t.replace(/^〔页面右下角有"白马公子"水印[^\n]*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  if (n === 11) {
    // 扩展单页的条栏注意事项降为四级标题,避免目录刷屏
    t = t.replace(/^## (注意：|小提示：)/gm, "#### $1");
    t = t.replace(/^## (步骤 [45]，)/gm, "### $1");
  }
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
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!/^[\s:|-]+$/.test(lines[i])) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push('<div class="table-wrap">\n<table>\n<thead>\n<tr>' + head.map(c => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n"
        + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("\n")
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="电力公司规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 12; n++) frags[n] = preprocess(n, readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/BIVeveLX6kIYAHX9qqZntw" target="_blank" rel="noopener">「白马公子」《电力公司》游戏规则</a>发布的《电力公司》(Power Grid) 中文规则书扫描件（Friedemann Friese 设计，基础规则书 8 页），并一并收录其所附<strong>《中国/韩国 地图扩展》</strong>的封面与规则单页（Rio Grande Games，2008，含韩国/中国两张资源补充表）。逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 2F-Spiele、Rio Grande Games 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：扫描件为灰度印刷品，书中未载中文翻译者与发行信息。原书排印问题较多，均照录并加〔原文如此〕：「到序」（应为倒序，P.1 流程卡注解）、「Aress」（应为 Areas，P.2）、「10 Elektron」（应为 Elektro，P.5 举例）、「颠序」「原料兜」（P.5）、「校燃料」「3分煤炭」（P.6）、「从新排序」（P.3/P.4/P.8）、「竟拍电厂」（P.7）、「也有可能有走到第二时期就结束」等病句，以及 P.4「重要：本阶段采取倒序」整框重复印刷、P.7 句号后孤立逗号等，均为原书排印如此。P.5 报酬表（0–20 城 × 收入）、P.8 补充资源表（2–6 人 × Step 1/2/3）与 P.12 韩国表（N/S 双行 × 45 格）、中国表（60 格）均已逐格人工核对。扩展单页为条栏排版，转录按左中右栏顺序。〔图 …〕说明为整理所拟；扫描件右下角「白马公子」水印非原书内容。</small></p>
</blockquote>`);

for (let n = 2; n <= 12; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

// BGG 评分（浏览器实测 boardgamegeek.com/boardgame/2651,2026-09）
const BGG = { id: "2651", rating: "7.8", rank: "76", weight: "3.25", users: "70000" };
const chip = `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${BGG.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${BGG.rating}，排名 #${BGG.rank}，权重/复杂度 ${BGG.weight}/5（1 轻松 ~ 5 重度），${BGG.users}人评分。点击查看原页面">⭐ BGG ${BGG.rating} · 排名 #${BGG.rank} · 权重 ${BGG.weight}/5 · 7万人评分</a>`;

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
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《电力公司》（Power Grid）中文规则书全文转录：2–6 人电厂竞拍与供电网络建设经典重策，三时期五阶段（竞拍电厂/购买原料/建设/发电收入），含获胜规则、2–6 人特殊规则、初次接触变体，并附 2008 年中国/韩国地图扩展规则与两张资源补充表全文，规则书扫描图随文嵌入。">
  <title>电力公司 Power Grid · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>⚡</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="powergrid">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">电力公司（Power Grid）</span>
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
          <h1 class="game-title">⚡ 电力公司</h1>
          <p class="game-sub">Power Grid · 设计：Friedemann Friese · 2–6 人（中文版规则书全文转录，附中国/韩国地图扩展规则）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 2–6 人</span>
            <span class="meta-chip">⏱️ 120 分钟左右</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
            <span class="meta-chip">⚡ 电厂竞拍与供电网络</span>
            <span class="meta-chip">🗺️ 附中国/韩国地图扩展</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/BIVeveLX6kIYAHX9qqZntw" target="_blank" rel="noopener">「白马公子」《电力公司》游戏规则</a>（《Power Grid》中文规则书及中国/韩国地图扩展扫描件）· 规则内容归 2F-Spiele、Rio Grande Games 及版权方所有，转录仅供个人学习查阅。</p>
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
