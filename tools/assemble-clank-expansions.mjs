// 把 content/_transcripts/{clank-catacombs-underworld,clank-adventuring-party}/ 的转录片段
// 装配为 games/clank-catacombs-underworld.html 与 games/clank-adventuring-party.html
// 用法: node tools/assemble-clank-expansions.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_UW = path.join(ROOT, "content", "_transcripts", "clank-catacombs-underworld");
const SRC_AP = path.join(ROOT, "content", "_transcripts", "clank-adventuring-party");
const SOURCE_URL = "https://mp.weixin.qq.com/s/rev2XGxuP-gsbYloNm-8bw";
const TODAY = "2026-09-24";

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

// 官方译名等排版归一:全角叹号→半角(仅 CLANK/Clank 后)、图注冒号、CJK 与西文/数字间空格
function normalizePunct(t) {
  t = t.replace(/(CLANK|Clank)！/g, "$1!");
  t = t.replace(/〔图：/g, "〔图:");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]):`, "g"), "$1：");
  t = t.replace(new RegExp(`([${CJK}）】」”〕])\\(`, "g"), "$1（");
  t = t.replace(new RegExp(`\\)([${CJK}（【“「〔])`, "g"), "）$1");
  // 去掉 CJK 与西文/数字(以及 CJK 相互间)之间的单空格,与既有各页体例一致
  t = t.replace(new RegExp(`([${CJK}）】」”〕〕]) (?=[${CJK}A-Za-z0-9（〔""])`, "g"), "$1");
  t = t.replace(/([A-Za-z0-9%）」〕!?.%]) (?=[\u4e00-\u9fff（〔““「【])/g, "$1");
  t = t.replace(/ ?\u2014\u2014 ?/g, "——");
  return t;
}

function preprocess(text, pageRule) {
  let t = text;
  t = t.replace(/^# .*$/gm, "");
  t = t.replace(/^（印刷页码：[^）]*）\s*$/gm, "");
  if (pageRule === "tokenGuide") {
    // 标记指南页:缎带标题为 h2,五大块降为 h3,条目降为 h4(与基础游戏页 P.16 层级一致)
    const lines = t.split("\n");
    let seenRibbon = false;
    t = lines.map((ln) => {
      if (/^## 标记指南\s*$/.test(ln)) { seenRibbon = true; return ln; }
      if (!seenRibbon) return ln;
      return ln.replace(/^### (.*)$/, "#### $1").replace(/^## (.*)$/, "### $1");
    }).join("\n");
  }
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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
        const indent = lines[i].match(/^\s*/)[0].length;
        items.push({ text: lines[i].replace(/^\s*-\s+/, ""), depth: indent >= 2 ? 1 : 0 });
        i++;
      }
      const top = [];
      let nest = null;
      const flushNest = () => {
        if (nest) {
          const inner = "<ul>\n" + nest.join("\n") + "\n</ul>";
          top[top.length - 1] = top[top.length - 1].replace(/<\/li>$/, inner + "</li>");
          nest = null;
        }
      };
      for (const it of items) {
        if (it.depth === 0) { flushNest(); top.push(`<li>${inline(it.text)}</li>`); }
        else { if (!nest) nest = []; nest.push(`<li>${inline(it.text)}</li>`); }
      }
      flushNest();
      out.push("<ul>\n" + top.join("\n") + "\n</ul>");
      continue;
    }
    let text = line.trim();
    out.push(`<p>${inline(text)}</p>`);
    i++;
  }
  return out.join("\n\n");
}

/* ---------- 页面配置 ---------- */

const PAGES = {
  uw: {
    slug: "clank-catacombs-underworld",
    theme: "clankuw",
    srcDir: SRC_UW,
    img: "../assets/img/clank-catacombs-underworld",
    gameKey: "clank-catacombs-underworld",
    nameZh: "CLANK! 地下墓穴:地下世界",
    nameEn: "Clank! Catacombs: Underworld",
    title: "CLANK! 地下墓穴:地下世界 (Clank! Catacombs: Underworld) · 规则 — 桌游规则书",
    h1: "💀 CLANK! 地下墓穴:地下世界",
    sub: "Clank! Catacombs: Underworld · 设计:Paul Dennen · Dire Wolf 出品/Renegade Game Studios(官方中文规则书全文转录) · 2–4 人扩展(需配合《CLANK! 地下墓穴》)",
    desc: "《CLANK! 地下墓穴:地下世界》(Clank! Catacombs: Underworld)官方简体中文规则书全文转录:冥界守卫、神器增强器、魔法竖琴、恶魔助手,命运房间与命运牌,冥界市场与冥界牢房,鹰身女妖/地下湖/塔楼等新板块元素,固定空间与宽恕变体,与《巢穴与失落的墓室》联动,全套标记指南,规则书扫描图随文嵌入,需配合基础游戏。",
    chips: [
      { type: "bgg", id: "447586", rating: "8.2", weight: "2.93", users: "441" },
      "👥 2–4 人",
      "⏱️ 30–60 分钟",
      "📖 简体中文规则书全文转录",
      "💀 冥界守卫 · 命运牌 · 恶魔助手",
      "🧩 需配合《CLANK! 地下墓穴》",
    ],
    noteExtra: `基础游戏规则见本站<a href="clank-catacombs.html">《CLANK! 地下墓穴》规则页</a>;另一扩展《CLANK! 冒险队》(5–6 人)见本站<a href="clank-adventuring-party.html">规则页</a>。`,
    note: "扫描共 4 图,对应规则书第 29–32 页(前两页页脚均印「30」,其一应为「29」之误,系原书排印如此);正文为简体照录;小节标题与〔图:…〕说明为整理所拟;文字与扫描图不符时以图为准。",
    capt: {
      1: "P.30(页脚印 30) 冥界元素:冥界守卫 · 神器增强器 · 魔法竖琴 · 恶魔助手",
      2: "P.30 冥界元素:命运房间 · 冥界市场 · 冥界牢房 · 其他板块元素(鹰身女妖/地下湖/塔楼)",
      3: "P.31 变体规则:固定空间 · 宽恕 · 使用巢穴与失落的墓室",
      4: "P.32 标记指南:囚犯/大型秘宝/小型秘宝/市场商品/冥界市场商品",
    },
    count: 4,
  },
  ap: {
    slug: "clank-adventuring-party",
    theme: "clankap",
    srcDir: SRC_AP,
    img: "../assets/img/clank-adventuring-party",
    gameKey: "clank-adventuring-party",
    nameZh: "CLANK! 冒险队",
    nameEn: "Clank! Adventuring Party",
    title: "CLANK! 冒险队 (Clank! Adventuring Party) · 规则 — 桌游规则书",
    h1: "🗡️ CLANK! 冒险队",
    sub: "Clank! Adventuring Party · 设计:Paul Dennen · Dire Wolf 出品/Renegade Game Studios(官方中文规则书全文转录) · 《CLANK!》5–6 人扩展(需配合基础游戏)",
    desc: "《CLANK! 冒险队》(Clank! Adventuring Party)官方简体中文规则书全文转录:《CLANK!》5–6 人扩展,两种新玩家颜色与 60 个方块,背包/王冠/万能钥匙/隐身斗篷,「反应(REACT)」「到达选择」新术语,阿格内特/达兰/加里纳尔/莱纳拉等专属角色,规则书扫描图随文嵌入,需配合基础游戏。",
    chips: [
      { type: "bgg", id: "308918", rating: "8.2", weight: "2.32", users: "2200" },
      "👥 基础 2–4 人 · 扩展至 5–6 人",
      "⏱️ 30–60 分钟",
      "📖 简体中文规则书全文转录(角色 4/6)",
      "🗡️ 六位专属角色 · 反应/到达选择",
      "🧩 需配合《CLANK!》基础游戏",
    ],
    noteExtra: `需配合《CLANK!》基础游戏使用;本站另收录《CLANK! 地下墓穴》及其扩展<a href="clank-catacombs-underworld.html">《CLANK! 地下墓穴:地下世界》</a>规则页。`,
    note: "扫描共 6 图(封底+页 34–38);总述称本扩展含六位专属角色,原帖扫描止于第 38 页(阿格内特/达兰/加里纳尔/莱纳拉四位),其余角色页未见于原帖,暂缺;被装订阴影遮盖处依残笔辨录,无法辨认处以〔?〕标注;正文为简体照录;小节标题与〔图:…〕说明为整理所拟。",
    capt: {
      1: "封底 · 游戏组件(127张卡牌/60个CLANK!方块/6张角色板/18个小型秘宝等)",
      2: "P.34 游戏组件:对基础游戏设置步骤的修改(A–I)",
      3: "P.35 设置修改步骤 J–N · 五人游戏(或六人):入手神器/小型秘宝/市场物品",
      4: "P.36 卡牌信息:反应(REACT) · 到达选择 · 扩展卡牌水印(VI)",
      5: "P.37 角色卡牌:阿格内特 · 达兰",
      6: "P.38 角色卡牌:加里纳尔 · 莱纳拉",
    },
    count: 6,
  },
};

/* ---------- 侧边栏(与全站一致的 canonical 列表,去掉本页自身) ---------- */

const SIDEBAR = [
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

function sidebarHtml(selfFile) {
  const items = SIDEBAR.filter(([f]) => f !== selfFile);
  return items.map(([f, n]) => `          <li><a href="${f}">${n}</a></li>`).join("\n");
}

/* ---------- 装配 ---------- */

function buildPage(key) {
  const P = PAGES[key];
  const frags = [];
  for (let n = 1; n <= P.count; n++) {
    const md = fs.readFileSync(path.join(P.srcDir, `p${String(n).padStart(2, "0")}.md`), "utf8");
    frags.push(mdToHtml(preprocess(md, key === "uw" && n === 4 ? "tokenGuide" : null)));
  }

  const figures = [];
  for (let n = 1; n <= P.count; n++) {
    const nn = String(n).padStart(2, "0");
    figures.push(`<figure>
<img src="${P.img}/${nn}.jpg" alt="${P.nameZh}规则书扫描图 ${nn}.jpg" loading="lazy">
<figcaption>扫描图 ${nn}.jpg · ${P.capt[n]}</figcaption>
</figure>`);
  }

  // 图 1 在来源说明之前作封面图,其余图与转录正文交替
  const parts = [];
  parts.push(figures[0]);
  parts.push(`<blockquote>
<p>本页整理自<a href="${SOURCE_URL}" target="_blank" rel="noopener">微信公众号「无忧桌游」《地下墓穴 扩展》</a>所载官方简体中文规则书扫描件,逐页全文转录,扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Dire Wolf、Renegade Game Studios 及版权方所有,转录仅供个人学习查阅。${P.noteExtra}</p>
<p><small>整理说明:${P.note}</small></p>
</blockquote>`);
  for (let n = 1; n <= P.count; n++) {
    if (n >= 2) parts.push(figures[n - 1]);
    parts.push(frags[n - 1]);
  }

  const chips = P.chips.map((c) => {
    if (typeof c === "string") return `            <span class="meta-chip">${c}</span>`;
    return `            <a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgameexpansion/${c.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${c.rating}，权重/复杂度 ${c.weight}/5（1 轻松 ~ 5 重度），${c.users}人评分。点击查看原页面">⭐ BGG ${c.rating} · 权重 ${c.weight}/5 · ${c.users}人评分</a>`;
  }).join("\n");

  const SITE_LD = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://zhibinai.cn/#website",
        name: "桌游规则书",
        url: "https://zhibinai.cn/",
        inLanguage: "zh-CN",
        description: "免费中文桌游规则书查询站：热门桌游完整中文规则全文 + Board Game Arena 全量官方规则中文版。",
      },
      {
        "@type": "WebPage",
        "@id": `https://zhibinai.cn/games/${P.slug}.html`,
        url: `https://zhibinai.cn/games/${P.slug}.html`,
        name: P.title,
        description: P.desc,
        isPartOf: { "@id": "https://zhibinai.cn/#website" },
        inLanguage: "zh-CN",
        dateModified: TODAY,
        primaryImageOfPage: { "@type": "ImageObject", url: `https://zhibinai.cn/assets/img/${key === "uw" ? "clank-catacombs-underworld" : "clank-adventuring-party"}/01.jpg` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: "https://zhibinai.cn/" },
          { "@type": "ListItem", position: 2, name: P.nameZh, item: `https://zhibinai.cn/games/${P.slug}.html` },
        ],
      },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="${P.desc}">
  <title>${P.title}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🐉</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="canonical" href="https://zhibinai.cn/games/${P.slug}.html">
  <meta property="og:site_name" content="桌游规则书">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${P.title}">
  <meta property="og:description" content="${P.desc}">
  <meta property="og:url" content="https://zhibinai.cn/games/${P.slug}.html">
  <meta property="og:image" content="https://zhibinai.cn/assets/img/${key === "uw" ? "clank-catacombs-underworld" : "clank-adventuring-party"}/01.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${P.title}">
  <meta name="twitter:description" content="${P.desc}">
  <script type="application/ld+json">${JSON.stringify(SITE_LD, null, 1).replace(/</g, "&lt;")}</script>
  <!-- seo-wired -->
</head>
<body data-theme="${P.theme}" data-game-key="${P.gameKey}">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">${P.nameZh}</span>
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
${sidebarHtml(P.slug + ".html")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">${P.h1}</h1>
          <p class="game-sub">${P.sub}</p>
          <div class="meta-chips">
${chips}
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源:<a href="${SOURCE_URL}" target="_blank" rel="noopener">微信公众号「无忧桌游」《地下墓穴 扩展》</a>(2026-05-25)· 规则内容归 Dire Wolf、Renegade Game Studios 及版权方所有,转录仅供个人学习查阅。</p>
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

  const out = path.join(ROOT, "games", `${P.slug}.html`);
  fs.writeFileSync(out, html);
  console.log(`written ${out} (${html.length} bytes)`);
}

buildPage("uw");
buildPage("ap");
