// 装配 games/gwt-new-zealand.html:content/_transcripts/gwt-new-zealand/*.md → 单页
// 扫描顺序混乱,按"一盒四册"各自印刷页码重排(页码勘定见复核报告)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TD = path.join(ROOT, "content", "_transcripts", "gwt-new-zealand");
const IMG = "assets/img/gwt-new-zealand";

// 重排后的顺序: [扫描文件号, 图注]
const ORDER = [
  ["_cover", "|主規則書(封面+印刷頁2–20)"],
  ["13", "封面:Great Western Trail New Zealand Rulebook"],
  ["03", "印刷頁2 · 引言(Kia ora) · 遊戲配件清單"],
  ["17", "印刷頁3 · 遊戲配件清單(綿羊卡/牌組建構卡/板塊/獎勵卡/港務長/目標卡/計分紙)"],
  ["29", "印刷頁4 · 遊戲設置(步驟1~11)"],
  ["25", "印刷頁5 · 遊戲設置(步驟12~19) · 首回合提示"],
  ["04", "印刷頁6 · 遊戲概要 · 牧羊牌庫與綿羊卡 · 回合流程"],
  ["08", "印刷頁7 · 階段A:牧場主移動 · 地點與過路費"],
  ["12", "印刷頁8 · 階段B:地點行動 · 威靈頓四步驟"],
  ["18", "印刷頁9 · 威靈頓:收入與運送"],
  ["06", "印刷頁10 · 階段B:運送行動結算 · 工人/天災/獎勵板塊"],
  ["01", "印刷頁11 · 獎勵市場標記 · 階段C:抽牌至手牌上限"],
  ["15", "印刷頁12 · 行動說明:圖示原則 · 棄牌代價 · 關鍵字"],
  ["24", "印刷頁13 · 雇用工人 · 投資獎勵板塊"],
  ["14", "印刷頁14 · 在綿羊市場採購 · 建造私有建築物板塊"],
  ["11", "印刷頁15 · 移動你的帆船 · 升級港口"],
  ["05", "印刷頁16 · 升級大型港口 · 剃毛行動"],
  ["26", "印刷頁17 · 獲得目標卡 · 前進你的開拓者軌"],
  ["02", "印刷頁18 · 交換指示物 · 附屬行動 · 移除天災 · 金塊"],
  ["28", "印刷頁19 · 遊戲結束 · 最終計分 · 港務長板塊計分"],
  ["07", "印刷頁20 · 常見問題及特殊狀況說明 · 製作團隊與版權"],
  ["_appendix", "|附錄:行動詳解(獨立頁碼;原帖缺頁2~3)"],
  ["19", "附錄冊頁1 · 中立建築物板塊(A~H)行動詳解"],
  ["16", "附錄冊頁4 · 其他行動:目標卡 · 附屬行動 · 獎勵板塊 · 獎勵卡"],
  ["_tiles", "|私有建築物板塊總覽(獨立頁碼;原帖缺頁1)"],
  ["10", "總覽冊頁2 · 私有建築物板塊 a 面(1a~10a)"],
  ["09", "總覽冊頁3 · 私有建築物板塊 b 面(1b~10b)"],
  ["_solo", "|英雌狠角色:單人模式(獨立頁碼)"],
  ["23", "單人冊頁1 · 英雌狠角色 · 遊戲設置與難度"],
  ["22", "單人冊頁2 · 遊戲進行 · 莎拉的移動"],
  ["27", "單人冊頁3 · 莎拉的行動:雇用/採購/建造"],
  ["21", "單人冊頁4 · 莎拉的行動:投資/目標/天災/水手/剃毛 · 範例"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

function md2html(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let para = [], quote = [], list = null;
  const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
  const flushQ = () => { if (quote.length) { out.push("<blockquote>" + quote.map((q) => "<p>" + inline(q) + "</p>").join("") + "</blockquote>"); quote = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>` + list.items.map((i) => "<li>" + inline(i) + "</li>").join("") + `</${list.t}>`); list = null; } };
  const flushAll = () => { flushP(); flushQ(); flushL(); };
  for (const raw of lines) {
    let line = raw.trimEnd();
    const t0 = line.trim();
    if (/^<!--[\s\S]*-->$/.test(t0)) continue;              // 整行注释
    line = line.replace(/<!--[\s\S]*?-->/g, "").trimEnd();  // 行内注释(引用块内配图注记等)
    const t = line.trim();
    if (!t) { flushAll(); continue; }
    if (/^〔掃描檔/.test(t) || /^印刷页码[:：]/.test(t) || /^印刷頁碼[:：]/.test(t)) continue; // 代理头注
    if (/^##\s*〔.*〕$/.test(t)) continue;                  // 版式结构注记标题
    if (/^>/.test(line)) { flushP(); flushL(); quote.push(line.replace(/^>\s?/, "")); continue; }
    flushQ();
    if (!line.trim()) { flushAll(); continue; }
    let m;
    if ((m = line.match(/^(#{1,2})\s+(.*)$/))) { flushAll(); out.push("<h2>" + inline(m[2]) + "</h2>"); continue; }
    if ((m = line.match(/^###\s+(.*)$/))) { flushAll(); out.push("<h3>" + inline(m[1]) + "</h3>"); continue; }
    if ((m = line.match(/^####\s+(.*)$/))) { flushAll(); out.push("<h4>" + inline(m[1]) + "</h4>"); continue; }
    if (/^(-|\*)\s+/.test(line)) { flushP(); if (!list) { flushL(); list = { t: "ul", items: [] }; } list.items.push(line.replace(/^(-|\*)\s+/, "")); continue; }
    if (/^\d+\.\s+/.test(line)) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(line.replace(/^\d+\.\s+/, "")); continue; }
    if (/^---+$/.test(line)) { flushAll(); continue; }
    flushL();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

const cache = {};
for (const f of fs.readdirSync(TD).filter((f) => /^\d{2}\.md$/.test(f))) {
  cache[f.slice(0, 2)] = fs.readFileSync(path.join(TD, f), "utf8");
}

const sections = [];
for (const [key, cap] of ORDER) {
  if (key.startsWith("_")) { sections.push("<h2 class=\"booklet-split\">" + cap.split("|")[1] + "</h2>"); continue; }
  const md = cache[key];
  if (!md) { console.error("缺少转录:", key); process.exit(1); }
  sections.push(
    `<figure>\n<img src="../${IMG}/${key}.jpg" alt="大西部开拓者新西兰开拓史规则书扫描图 ${key}" loading="lazy">\n<figcaption>扫描图 ${key} · ${cap}</figcaption>\n</figure>\n\n` +
    md2html(md)
  );
}

const NAV = [
  ["7-wonders", "🏛️ 七大奇迹"], ["ark-nova-marine-worlds", "🐙 方舟动物园:海洋世界"],
  ["ascension", "🃏 创升纪元"], ["barcelona", "🌸 巴塞罗那"],
  ["brass-birmingham", "🏭 工业革命:伯明翰"], ["clank-catacombs", "🐉 CLANK! 地下墓穴"],
  ["dune-imperium", "🏜️ 沙丘:帝国"], ["dune-imperium-uprising", "🪱 沙丘:帝国起义"],
  ["druids-of-edora", "🌲 埃多拉的德鲁伊"], ["endeavor-deep-sea", "🌊 奋进号:深海"],
  ["fields-of-arle", "🌾 阿勒農場"], ["food-chain-magnate", "🍔 快餐连锁大亨"],
  ["galileo-galilei", "🔭 伽利略:伽利莱"], ["grand-austria-hotel", "🏨 奥地利大饭店"],
  ["orloj", "🕰️ 奥洛伊:布拉格天文钟"], ["pokemon-grove", "🌳 宝可梦林地探索"],
  ["power-grid", "⚡ 电力公司"], ["puerto-rico", "⛵ 波多黎各"],
  ["seti", "🛰️ SETI:寻找外星人"], ["speakeasy", "🎷 地下酒吧"],
  ["the-message", "🕵️ 风声再临"], ["trajan", "🦅 图拉真"],
  ["tulip-bubble", "🌷 郁金香泡沫"], ["vale-of-eternity", "✨ 永恒之谷"],
  ["wingspan", "🦜 展翅翱翔"],
];
const navLis = NAV.map(([slug, label]) => `          <li><a href="${slug}.html">${label}</a></li>`).join("\n");

const DESC = "《大西部开拓者:新西兰开拓史》(Great Western Trail: New Zealand,Alexander Pfister 设计,eggertspiele 出版/本长文化发行)繁体中文规则书全文转录:1–4 人(含单人「英雌狠角色」)的南岛牧场经营游戏,牧羊人移动、绵羊市场、帆船运送与威灵顿四步骤,一盒四册(主规则书+行動詳解+私有建築物板塊總覽+單人册),规则书扫描图随文嵌入。";
const TITLE = "大西部开拓者:新西兰开拓史 (Great Western Trail: New Zealand) · 规则 — 桌游规则书";
const URL = "https://zhibinai.cn/games/gwt-new-zealand.html";

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="${DESC}">
  <title>${TITLE}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🐑</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="canonical" href="${URL}">
  <meta property="og:site_name" content="桌游规则书">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${TITLE}">
  <meta property="og:description" content="${DESC}">
  <meta property="og:url" content="${URL}">
  <meta property="og:image" content="https://zhibinai.cn/${IMG}/13.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${TITLE}">
  <meta name="twitter:description" content="${DESC}">
  <script type="application/ld+json">{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "WebSite",
   "@id": "https://zhibinai.cn/#website",
   "name": "桌游规则书",
   "url": "https://zhibinai.cn/",
   "inLanguage": "zh-CN",
   "description": "免费中文桌游规则书查询站：热门桌游完整中文规则全文 + Board Game Arena 全量官方规则中文版。"
  },
  {
   "@type": "WebPage",
   "@id": "${URL}",
   "url": "${URL}",
   "name": "${TITLE}",
   "description": ${JSON.stringify(DESC)},
   "isPartOf": { "@id": "https://zhibinai.cn/#website" },
   "inLanguage": "zh-CN",
   "dateModified": "2026-09-20",
   "primaryImageOfPage": { "@type": "ImageObject", "url": "https://zhibinai.cn/${IMG}/13.jpg" }
  },
  {
   "@type": "BreadcrumbList",
   "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "首页", "item": "https://zhibinai.cn/" },
    { "@type": "ListItem", "position": 2, "name": "大西部开拓者:新西兰开拓史 (Great Western Trail: New Zealand)", "item": "${URL}" }
   ]
  }
 ]
}</script>
  <!-- seo-wired -->
</head>
<body data-theme="gwt" data-game-key="gwt-new-zealand">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">大西部开拓者:新西兰开拓史</span>
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
${navLis}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🐑 大西部开拓者:新西兰开拓史</h1>
          <p class="game-sub">Great Western Trail: New Zealand · 设计:Alexander Pfister · eggertspiele 出版/本长文化发行 · 1–4 人(繁体中文规则书全文转录,含单人模式)</p>
          <div class="meta-chips">
            <a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/380607" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 8.4，排名 #73，权重/复杂度 3.99/5（1 轻松 ~ 5 重度），7400人评分。点击查看原页面">⭐ BGG 8.4 · 排名 #73 · 权重 3.99/5 · 7400人评分</a>
            <span class="meta-chip">👥 1–4 人(含单人)</span>
            <span class="meta-chip">⏱️ 75–150 分钟左右</span>
            <span class="meta-chip">📖 繁体中文规则书全文转录</span>
            <span class="meta-chip">🐑 绵羊牧场 · 帆船运送 · 威灵頓</span>
            <span class="meta-chip">📦 一盒四册(主书+附錄+總覽+單人)</span>
          </div>
        </header>

<blockquote>
<p>本页整理自<a href="https://www.gstonegames.com/game/doc-4984.html" target="_blank" rel="noopener">集石《大西部开拓者:新西兰开拓史》词条</a>所载非官方规则书扫描件(2024-07-06 发布,29 图,去重后 28 页),逐页全文转录,扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Alexander Pfister、eggertspiele、本长文化及版权方所有,转录仅供个人学习查阅。</p>
<p><small>整理说明:原帖扫描顺序混乱,本页已按「一盒四册」各自的印刷页码重排——①主規則書(封面+印刷頁 2~20);②附錄:行動詳解(獨立頁碼,原帖缺頁 2~3);③私有建築物板塊總覽(獨立頁碼,原帖缺頁 1);④英雌狠角色:單人模式(獨立頁碼,頁 1~4 完整)。封面在原帖连贴两次,已去重。繁体原样照录、未作繁简转换;原书排印问题照录:「追朔」(追溯之误)、「並獲等同本次總羊毛值」缺「得」、「并相应的任何运费」缺「支付」、「将在第15进行说明」缺「頁」、「沙拉/莎拉」混用、「開拓者轨/開拓之路」混用等;图示小字无法辨认处以〔圖示:…〕/〔?〕标注,未按常识补全。</small></p>
</blockquote>

${sections.join("\n\n")}

        <footer class="source-note">
<p>来源:<a href="https://www.gstonegames.com/game/doc-4984.html" target="_blank" rel="noopener">集石《大西部开拓者:新西兰开拓史》非官方规则书</a>(来源标注:其它)· 规则内容归 Alexander Pfister、eggertspiele、本长文化及版权方所有,转录仅供个人学习查阅。</p>
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

const outPath = path.join(ROOT, "games", "gwt-new-zealand.html");
fs.writeFileSync(outPath, html);
console.log("written", outPath, (html.length / 1024).toFixed(0) + "KB");
