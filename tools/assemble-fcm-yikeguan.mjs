// 把 content/_transcripts/fcm-yikeguan/ 下的 15 页转录片段装配为 games/food-chain-magnate.html
// (一刻馆官方中文版,取代此前焦无耻排印译本;旧版见 Git 历史 1a76ebc)
// 用法: node tools/assemble-fcm-yikeguan.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "fcm-yikeguan");
const OUT = path.join(ROOT, "games", "food-chain-magnate.html");
const IMG = "../assets/img/food-chain-magnate";

// 每页插图题注
const CAPTIONS = {
  1: "规则书封面 · 快餐连锁大亨 FOOD CHAIN Magnate（Splotter Spellen 出品，一刻馆发行官方中文版）",
  2: "P.2 制作人员与大中华区版权信息 · 快餐连锁大亨导语",
  3: "P.3 游戏配件（一）：游戏盒 / 规则书 / 中文菜单 / 回合顺位表 / 地图与营销板块 / 快餐连锁店",
  4: "P.4 游戏配件（二）：员工牌 / 里程碑牌 / 银行资金储备牌 / 纸质钞票 · 游戏概述 · 概念解释",
  5: "P.5 初始设置：卡牌设置（人数表格）· 18 张里程碑牌总览 · 地图设置",
  6: "P.6 员工牌升级路线总览（27 张牌八行图）",
  7: "P.7 银行资金储备 · 玩家标记 · 初始顺位 · 放置第一家快餐店 · 选择目标 · 阶段一重组结构 · 阶段二商业秩序",
  8: "P.8 公司组织结构示例 · 阶段三：工作时间 9:00-17:00 · 招聘 · 培训",
  9: "P.9 发起营销活动：广告类型 / 距离 / 持续时长 / 放置营销板块 / 决定广告内容 · 示例",
  10: "P.10 拿取食物和饮料（采购与厨房员工） · 放置或移动快餐店 · 放置新的房屋和花园",
  11: "P.11 阶段四：晚餐时间（八步判定与收入示例） · 服务员 · 首席财务官 · 银行两次破产",
  12: "P.12 阶段五：发放薪水 · 阶段六：营销活动（四类广告） · 阶段七：清理阶段",
  13: "P.13 里程碑牌详解（一）：篇首说明与九种里程碑",
  14: "P.14 里程碑牌详解（二）：降价 / 手推车 / 飞机 / 广播 / $100 / 高薪",
  15: "P.15 游戏说明（首局变体五条建议） · 游戏策略（十条指南）",
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
  t = t.replace(/^（页码[^）]*）\s*$/gm, "");
  t = t.replace(/^页码[:：]?\d*\s*$/gm, "");
  t = t.replace(/^\d{1,2}\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  if (n === 2) {
    t = t.replace(/^## 页眉标题\s*$/gm, "");
    t = t.replace(/^快餐连锁 FOOD CHAIN Magnate 大亨\s*$/gm, "");
  }
  // 组件展示页(P.3/P.4 前半):短行组件名转为列表项
  if (n === 3 || n === 4) {
    const cut = t.indexOf("\n## ");
    const head = cut >= 0 ? t.slice(0, cut) : t;
    const rest = cut >= 0 ? t.slice(cut) : "";
    const conv = head.replace(/^(?!〔)(?!#)(?!-)(.{1,14})$/gm, (m, s) => s.trim() ? `- ${s.trim()}` : m);
    t = conv + rest;
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
    // Markdown 表格
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!/^[\s:|-]+$/.test(lines[i])) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push("<table>\n<thead>\n<tr>" + head.map(c => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n"
        + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("\n")
        + "\n</table>");
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="快餐连锁大亨官方中文版规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 15; n++) frags[n] = preprocess(n, readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/Dy8X0sICGQ19fZjrZCUdNw" target="_blank" rel="noopener">「桌游怎么玩」《快餐连锁大亨【桌游规则】Food Chain Magnate》</a>发布的《快餐连锁大亨》一刻馆官方中文版规则书（Splotter Spellen 出品，大中华地区独家版权：一刻馆桌游，全书 15 页含封面），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Splotter Spellen、一刻馆及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：本页此前收录的焦无耻排印中文译本（译自英文原版书）已由本一刻馆官方中文版整体取代，旧版全文见仓库 Git 历史（提交 1a76ebc）。一刻馆官译用语照录：「员工牌/员工工位」「忙碌标记」「银行资金储备牌」「里程碑牌」「免下车服务」「即将开业/欢迎光临」「快餐店入口」等。原书排印问题照录并加〔原文如此〕：英文人名单词间无空格连排（P.2 制作人员），「这意味著」（P.9、P.13），「你经过与饮料进货点（正交）相邻道路格才行」（P.10），「快餐店，大区经理」半角逗号（P.10），「将会死宅在家里」「出现次数的最多」（P.11），「有关。）。」（P.12），以及里程碑金额两处不一致——P.5 里程碑牌图印作「首个拥有$700」而 P.14 详解印作「首个拥有$100」（效果描述相同，均为首席执行官视同首席财务官）。P.3 游戏盒封面气泡标语与盒底小字扫描分辨率下无法完全辨认，已照实标注。〔图 …〕说明与个别小节标题为整理所拟。</small></p>
</blockquote>`);

for (let n = 2; n <= 15; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

const BGG = { id: "175914", rating: "8.0", rank: "52", weight: "4.18", users: "24000" };
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
  ["clank-catacombs.html", "🐉 CLANK! 地下墓穴"],
  ["ark-nova-marine-worlds.html", "🐙 方舟动物园：海洋世界"],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《快餐连锁大亨》（Food Chain Magnate）一刻馆官方中文版规则书全文转录：2–5 人卡牌驱动的快餐帝国经营重策，七个游戏阶段（重组结构/商业秩序/工作时间/晚餐时间/发放薪水/营销活动/清理），18 张里程碑牌详解与首局变体、策略指南，规则书扫描图随文嵌入。">
  <title>快餐连锁大亨 · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🍔</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="fcm">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">快餐连锁大亨（Food Chain Magnate）</span>
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
          <h1 class="game-title">🍔 快餐连锁大亨</h1>
          <p class="game-sub">Food Chain Magnate · 设计：Jeroen Doumen / Joris Wiersinga · Splotter Spellen 出版（2015）· 一刻馆官方中文版规则书全文转录</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 2–5 人</span>
            <span class="meta-chip">⏱️ 120–240 分钟</span>
            <span class="meta-chip">📖 官方中文规则书全文转录</span>
            <span class="meta-chip">🏭 卡牌驱动员工管理</span>
            <span class="meta-chip">💰 营销与定价竞争</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/Dy8X0sICGQ19fZjrZCUdNw" target="_blank" rel="noopener">「桌游怎么玩」《快餐连锁大亨【桌游规则】Food Chain Magnate》</a>（《Food Chain Magnate》一刻馆官方中文版规则书）· 规则内容归 Splotter Spellen、一刻馆及版权方所有，转录仅供个人学习查阅。</p>
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
