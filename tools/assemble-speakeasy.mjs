// 把 content/_transcripts/speakeasy/ 下的 24 页转录片段装配为 games/speakeasy.html
// 用法: node tools/assemble-speakeasy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "speakeasy");
const OUT = path.join(ROOT, "games", "speakeasy.html");
const IMG = "../assets/img/speakeasy";

// 每页插图题注
const CAPTIONS = {
  1: "规则书封面 · 地下酒吧 Speakeasy（设计：Vital Lacerda · Eagle-Gryphon Games，中文翻译&排版：陈斌华）",
  2: "P.2 目录 · 你将在游戏里做什么？ · 获胜条件 · Credits",
  3: "P.3 游戏配件（36 项清单）",
  4: "P.4 设置：主版图与 2 人游戏封锁 · 黑帮（步骤 1–9） · 警察（步骤 10–11）",
  5: "P.5 设置（续）：城市板块 · 区域/中央公园目标板块 · 经营和帮手卡 · 城市码头版图 · 供应堆",
  6: "P.6 玩家设置：经营版图 / 保险箱屏风 / 主版图 · 轮次设置（1920）",
  7: "P.7 关键概念：经营等级 · 经营建筑与黄金法则 · 合伙人黑帮 · 打手 · 家族成员 · 攻击和防御 · 洗钱 · 封锁地区",
  8: "P.8 游戏流程：幕结构 · 1. 返还分支头目 · 2. 玩家轮 · 回合顺位",
  9: "P.9 3. 幸运卢西亚诺阶段 · 3.1 黑帮战争（步骤与防御势力）",
  10: "P.10 黑帮板块图解（Carlo Gambino 示例） · 3.2 警察巡逻曼哈顿 · 3.3 支出区域控制费用",
  11: "P.11 区域控制检查举例 · 地区控制层级 · 幸运卢西亚诺支出奖金",
  12: "P.12 常见行动和效果：打出经营卡牌 / 提高经营等级 / 势力 / 恶名 / 弃卡 / 拿卡",
  13: "P.13 生产酒桶 · 出售酒桶 · 雇佣打手 · 获得家族成员（VIP 房/码头） · 地区与感兴趣的人",
  14: "P.14 地点：承包商办公室（开设/接管/升级折扣） · 城市板块回合结束处理",
  15: "P.15 地点：城市规划办公室（夜店与赌场） · 完整举例",
  16: "P.16 地点：车库（车队卡、卡车移动、拾取与运输酒桶） · 两个举例",
  17: "P.17 地点：市政厅（影响力与保护） · 委员会（帮手卡/合伙人黑帮）",
  18: "P.18 地点：码头（酿酒厂卡 / 免费打手 / 伏击朗姆酒运输船与结算） · 举例",
  19: "P.19 地点：餐厅（改变回合顺位 · 城市板块 · 篡改账簿） · 篡改账簿区域需求",
  20: "P.20 地点：公园（交换分支头目） · 4. 最终计分轮 · 1933 年 12 月 5 日",
  21: "P.21 提示（金钱/恶名/建筑须知） · 黄金法则 · 变体规则：重建你的酿酒厂",
  22: "P.22 卡牌和板块解释：合伙人能力 · 木箱板块（27 块）",
  23: "P.23 篡改账簿目标（中央公园 A/B/C · 分区 · 码头 · 市政厅 · 恶名）",
  24: "P.24 帮手卡（21 张） · 城市板块（18 块）",
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
  t = t.replace(/^# 地下酒吧\s*$/gm, "");
  t = t.replace(/^（页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（页脚页码[^）]*）\s*$/gm, "");
  t = t.replace(/^〔页码[^〕]*〕\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  // 标题规整（去纯排版括注,保留分栏次序）
  t = t.replace(/^## （接上页设置步骤）\s*$/gm, "## 设置（续：步骤 12–23）");
  t = t.replace(/^## 一个黑帮的黑帮战争势力（中栏）\s*$/gm, "## 一个黑帮的黑帮战争势力");
  t = t.replace(/^## 建筑防御势力（右栏）\s*$/gm, "## 建筑防御势力");
  t = t.replace(/^## 中栏举例（续）\s*$/gm, "### 举例（续）");
  t = t.replace(/^## 黑帮板块（左栏图解）\s*$/gm, "## 黑帮板块图解");
  t = t.replace(/^## 警告框（页面底部）\s*$/gm, "### 警告：黑帮势力逐幕增强");
  t = t.replace(/^## Credits（页脚，英文逐行照录）\s*$/gm, "## Credits");
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
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="地下酒吧规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 24; n++) frags[n] = preprocess(n, readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/rd8TwTQ70XzUmEGOD9h1Lg" target="_blank" rel="noopener">「桌游怎么玩」《地下酒吧，Speakeasy【桌游规则】》</a>发布的《地下酒吧》(Speakeasy) 中文规则书（设计：Vital Lacerda，Eagle-Gryphon Games 出版，中文翻译&排版：陈斌华，全书 24 页含封面），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Eagle-Gryphon Games、FRED Distribution 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：本译本为玩家汉化排版（陈斌华，译笔与《Age of Innovation》同源），非出版社官方中文规则书。陈斌华译本用语照录：「经营卡/经营牌」「经营版图」「分支头目」「家族成员」「打手」「合伙人黑帮」「恶名」「账簿」「木箱板块」「幸运卢西亚诺」等；「经营卡」与「经营牌」原书混用照录。原书排印问题较多，均照录并加〔原文如此〕：封面「VitalLacerda」无空格（P.1）、「每次翻开一板块」（P.4）、列表编号「a、b」后突为大写「C」（P.5）、「昂达」（P.5）、「将酒桶，经常，钱币」（P.5）、「将你的开设的」（P.6）、「放在在没有分支头目的人员身上」「见底 19 页」（P.8）、小节标题「幸运卢卡斯诺」与正文「卢西亚诺」不一致（P.9）、「黑帮地区 板块」空格、「地下酒馆都已丢失」「为了，支付」（P.9）、「3.2.」标题带句点（P.10）、「2 黑帮地下酒吧」量词（P.11）、「接管该酒馆」（P.14）、「至多 1 个夜店和 1 赌场」「选从你手上」（P.15）、「向卡车运送了一酒桶」「沆瀣一气」（P.16）、「见从你手上打出……」「家族成员会员」「有 3 家族成员」（P.17）、「拿到 15 美元到手」「St.Clair/St. Clair」拼写不一（P.18）、「移动回合顺位轨道下面一行」「这两个位置」（P.19）、「24 美元 /25 美元」（P.21）、「出手酒桶」「你的的手牌」（P.22）、「带有独特瓶子的帮助卡」（P.24）等。〔图 …〕说明与个别小节标题为整理所拟。</small></p>
</blockquote>`);

for (let n = 2; n <= 24; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

// BGG 评分（浏览器实测 boardgamegeek.com/boardgame/375459,2026-09）
const BGG = { id: "375459", rating: "8.4", rank: "219", weight: "4.43", users: "4514" };
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
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《地下酒吧》（Speakeasy）中文规则书全文转录：1–4 人禁酒时代黑帮题材的工人放置+卡牌管理+区域控制重策，四个幕11个玩家轮，黑帮战争/警察巡逻/朗姆酒运输船/篡改账簿，八大地点与合伙人体系，含单人模式，规则书扫描图随文嵌入。">
  <title>地下酒吧 Speakeasy · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🎷</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="speakeasy">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">地下酒吧（Speakeasy）</span>
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
          <h1 class="game-title">🎷 地下酒吧</h1>
          <p class="game-sub">Speakeasy · 设计：Vital Lacerda · Eagle-Gryphon Games 出版（2025）· 中文规则书全文转录（翻译&排版：陈斌华）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 1–4 人（含单人模式）</span>
            <span class="meta-chip">⏱️ 每人约 45 分钟</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
            <span class="meta-chip">🎩 禁酒时代黑帮经营</span>
            <span class="meta-chip">🗺️ 工人放置+区域控制</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/rd8TwTQ70XzUmEGOD9h1Lg" target="_blank" rel="noopener">「桌游怎么玩」《地下酒吧，Speakeasy【桌游规则】》</a>（《Speakeasy》中文规则书，翻译&排版：陈斌华）· 规则内容归 Eagle-Gryphon Games、FRED Distribution 及版权方所有，转录仅供个人学习查阅。</p>
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
