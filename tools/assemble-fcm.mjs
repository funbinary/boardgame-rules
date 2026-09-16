// 把 content/_transcripts/fcm/ 下的 15 页转录片段装配为独立游戏页 games/food-chain-magnate.html
// 用法: node tools/assemble-fcm.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "fcm");
const OUT = path.join(ROOT, "games", "food-chain-magnate.html");
const IMG = "../assets/img/food-chain-magnate";

const CAPTIONS = {
  1: "封面 · FOOD CHAIN Magnate RULES(Splotter,2015 年第三印)——「今晚别做饭,来玩 Splotter 的盛宴」",
  2: "版权页 COLOFON(设计师/美工/测试名单)· 游戏介绍(中文翻译:焦无耻)",
  3: "P.2 配件清单(上):盒装件 · 规则书 · 提示卡 · 顺位轨 · 地图/住宅/花园/营销片",
  4: "P.3 配件清单(下):员工卡 · 成就卡 · 储备金卡 · CEO 卡 · 纸币与食物标记 · 概览 · 重要概念",
  5: "P.4 游戏设置:卡牌设置 · 玩家数表 · 地图设置 · 18 张成就卡总览",
  6: "P.5 员工卡晋升图(9 条晋升链,24 种职位)",
  7: "P.6 设置收尾(银行现金/起始资源/首家连锁店/设定目标)· 游戏流程:阶段1 公司改组 · 阶段2 决定顺位",
  8: "P.7 例:公司结构 · 阶段3 工作时间:雇佣与培训",
  9: "P.8 营销:距离 · 持续时长 · 投放广告 · 广告牌示例",
  10: "P.9 生产食物和饮料 · 放置住宅或花园 · 新连锁店的开设或搬迁",
  11: "P.10 阶段4:晚餐时间(消费判定/价格竞争/花园/waitress/CFO/银行耗尽)",
  12: "P.11 阶段5 支付工资 · 阶段6 市场营销 · 阶段7 整理",
  13: "P.12 成就卡(上):9 张成就详解",
  14: "P.13 成就卡(下):6 张成就详解",
  15: "P.14 初次游戏(五条简化规则)· 策略指引",
};

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

// 中文语境的半角标点统一为全角(原扫描字体全角标点呈窄形,转录时记为半角,此处仅作显示归一)
function normalizePunct(t) {
  t = t.replace(new RegExp(`([${CJK}）】」”〕]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]):`, "g"), "$1：");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]);`, "g"), "$1；");
  t = t.replace(new RegExp(`([${CJK}）】」”〕])\\?`, "g"), "$1？");
  t = t.replace(new RegExp(`([${CJK}）】」”〕])!`, "g"), "$1！");
  return t;
}

function preprocess(text) {
  let t = text;
  t = t.replace(/^# .*$/gm, "");            // 页标题行
  t = t.replace(/^<!--.*-->$/gm, "");       // HTML 注释行
  t = t.replace(/^页脚:.*$/gm, "");          // 页脚说明行
  t = t.replace(/^\(页脚页码[:：]\d+\)\s*$/gm, "");
  t = t.replace(/^（印刷页码[:：]\d+；[^）]*）\s*$/gm, "");
  t = t.replace(/^\(转录注:.*\)\s*$/gm, ""); // 已并入页首整理说明
  t = t.replace(/^---\s*$/gm, "");
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(/【图[:：]([^】]*)】/g, "<em>〔图$1〕</em>");
  out = out.replace(/&lt;br&gt;/gi, "<br>"); // 表格单元格内的换行
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
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      let html = "<table>\n<thead>\n<tr>" + cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n<tbody>\n";
      for (const r of rows.slice(1)) {
        if (/^[\s|:-]+$/.test(r)) continue;
        html += "<tr>" + cells(r).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>\n";
      }
      out.push(html + "</tbody>\n</table>");
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
    out.push(`<p>${inline(line.trim())}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="快餐连锁大亨规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
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
  ["trajan.html", "🦅 图拉真"],
  ["tulip-bubble.html", "🌷 郁金香泡沫"],
  ["galileo-galilei.html", "🔭 伽利略：伽利莱"],
  ["orloj.html", "🕰️ 奥洛伊：布拉格天文钟"],
  ["food-chain-magnate.html", "🍔 快餐连锁大亨"],
];
const sidebarItems = SIDEBAR_GAMES.map(
  ([href, label]) => `          <li><a href="${href}">${label}</a></li>`
).join("\n");

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/0xN6ZDRIY_2Wv1UvQ2Mkjw" target="_blank" rel="noopener">「桌游怎么玩」《快餐连锁大亨[Food Chain Magnate]》</a>发布的 Splotter Spellen《Food Chain Magnate》英文原版规则书排印中文译文的扫描图（封面 + 内页 14 页，译者页署名「翻译By 焦无耻」，扫描页带发布方「乐智源桌游工作室」水印），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。内容涵盖配件清单、概览与重要概念、游戏设置（玩家数表/18 张成就卡总览）、员工卡晋升图、游戏流程七阶段（公司改组/决定顺位/工作时间/晚餐时间/支付工资/市场营销/整理）、营销、生产与放置住宅花园、15 张成就卡详解、初次游戏简化规则与策略指引。规则内容归 Splotter Spellen 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：原书为英文原版排版、其上排印中文译文，员工卡/成就卡名等多保留英文照录（如 waitress、Pricing manager）。原书排印与用字均照录：P.3「介绍了这名员工在工作效果」「员工卡包含经历、市场工作人员……」等句；P.4「将上表所示的营销片放回游戏盒中」表前表后两见（前者无句号、后者有句号）；P.6「经历的直接下级只能是普通员工」疑为「经理的」；P.10「成就卡会也会让价格-$1」衍一「会」字，「居(xi)民(xue)们(gui)」「色狼！」为译者插科打诨；P.11「将剩余的全部同名成就卡。翻面」句读原书如此；P.12「如果玩家还有没用光的培训次数」疑为「没有用光」；「2*2格」「5*5格」的星号、金额「$ 15」类的半角空格均为原书排印。P.4 成就卡总览中 FIRST TO HIRE 3 PEOPLE IN 1 TURN、FIRST BURGER PRODUCED、FIRST PIZZA PRODUCED 三卡原书未排印中文，已以〔〕注明。全书未设独立「游戏结束」章节：结束条件见「概览」（银行现金两次耗尽后现金最多者胜）与「阶段4」银行耗尽规则。扫描页经逐页放大转录与数字逐位核对，无〔?〕存留。</small></p>
</blockquote>`);

for (let n = 2; n <= 15; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(preprocess(fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8"))));
}
const body = parts.join("\n\n");

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《快餐连锁大亨》（Food Chain Magnate）中文规则书全文转录：2–5 人卡牌驱动重策，雇佣培训员工、营销创造需求、定价竞争居民消费，银行现金两次耗尽后最富者胜，含员工卡晋升图、18 张成就卡与初次游戏简化规则，规则书扫描图随文嵌入。">
  <title>快餐连锁大亨（Food Chain Magnate）· 规则 — 桌游规则书</title>
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
${sidebarItems}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🍔 快餐连锁大亨</h1>
          <p class="game-sub">Food Chain Magnate · 设计：Jeroen Doumen / Joris Wiersinga · Splotter Spellen 出版（2015）· 中文粉丝翻译版规则书全文转录（翻译：焦无耻）</p>
          <div class="meta-chips">
            <a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/175914" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 8.0，排名 #52，权重/复杂度 4.18/5（1 轻松 ~ 5 重度），2.4万人评分。点击查看原页面">⭐ BGG 8.0 · 排名 #52 · 权重 4.18/5 · 2.4万人评分</a>
            <span class="meta-chip">👥 2–5 人</span>
            <span class="meta-chip">⏱️ 120–240 分钟</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
            <span class="meta-chip">🏭 卡牌驱动员工管理</span>
            <span class="meta-chip">💰 营销与定价竞争</span>
          </div>
        </header>

${body}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/0xN6ZDRIY_2Wv1UvQ2Mkjw" target="_blank" rel="noopener">「桌游怎么玩」《快餐连锁大亨[Food Chain Magnate]》</a>（Splotter Spellen《Food Chain Magnate》英文原版规则书排印中文译文，译者：焦无耻）· 规则内容归 Splotter Spellen 及版权方所有，转录仅供个人学习查阅。</p>
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
console.log(`written ${OUT} (${html.length} bytes)`);
