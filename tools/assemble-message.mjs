// 装配 games/the-message.html:content/_transcripts/the-message/*.md → 单页,扫描图随文嵌入
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TD = path.join(ROOT, "content", "_transcripts", "the-message");
const IMG = "assets/img/the-message";

const CAPTIONS = {
  "01": "游戏简介 · 游戏类型与人数 · 新手教学模式 · 组件:身份牌",
  "02": "游戏人数身份配置 · 基础牌 87 张 · 功能与情报 · 密电/文本/直达三种传递方式",
  "03": "角色牌 25 张 · 技能/卡牌的使用与响应 · 游戏准备",
  "04": "游戏开始 · 回合中的情报步骤 · 角色死亡 · 游戏获胜及结束",
  "05": "基础牌功能:试探 · 秘密下达 · 公开文本",
  "06": "基础牌功能:截获 · 转移 · 调虎离山 · 烧毁",
  "07": "基础牌功能:调包 · 离间 · 危险情报 · 识破",
  "08": "基础牌功能:增援 · 机密文件 · 破译 · 锁定",
  "09": "角色技能:老枪(声东击西/合谍) · 大美女(精明/算计) · 浮萍(先机后置/牺牲)",
  "10": "角色技能:蝮蛇(无限弹药/战术大师) · 谭电员(反侦/速译) · 峨眉峰(计中计/截上截)",
  "11": "角色技能:钢铁特工(核燃机体/核能芯片) · 七百(机敏/联动) · 致命香水(致命一击/绝密任务)",
  "12": "角色技能:老鬼(就计/城府) · 小白(乔装/收买) · 黑玫瑰(血染/凋零)",
  "13": "角色技能:老金(弃车保帅/破釜沉舟) · 闪灵(装填/狙击) · 黄雀(潜藏伏击/黄雀在后)",
  "14": "角色技能:戴笠(运筹帷幄/笑里藏刀) · 刀锋(杀意/亮剑) · 小马哥(英雄本色/成仁取义)",
  "15": "角色技能:贝雷帽(险境还生/单枪匹马) · 福尔摩斯(线索/真相) · 怪盗九九(窃于无形/帽子戏法)",
  "16": "角色技能:情报处长(偷龙转凤/紧急下达) · 六姐(搜取/拷问) · 礼服蒙面(危机关系/以爱宣名)",
  "17": "角色技能:职业杀手(雇佣关系/暗杀) · 游戏用语概念说明",
};

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
    const line = raw.trimEnd();
    if (/^<!--[\s\S]*-->$/.test(line.trim())) continue; // 转录文件内的 HTML 注释行,剥离
    if (/^>/.test(line)) { flushP(); flushL(); quote.push(line.replace(/^>\s?/, "")); continue; }
    flushQ();
    if (!line.trim()) { flushAll(); continue; }
    let m;
    if ((m = line.match(/^(#{1,2})\s+(.*)$/))) { flushAll(); out.push("<h2>" + inline(m[2]) + "</h2>"); continue; }
    if ((m = line.match(/^###\s+(.*)$/))) { flushAll(); out.push("<h3>" + inline(m[1]) + "</h3>"); continue; }
    if ((m = line.match(/^####\s+(.*)$/))) { flushAll(); out.push("<h4>" + inline(m[1]) + "</h4>"); continue; }
    if (/^(-|\*)\s+/.test(line)) {
      flushP();
      const t = /^\*\s/.test(line) ? "ul" : "ul";
      if (!list || list.t !== t) { flushL(); list = { t, items: [] }; }
      list.items.push(line.replace(/^(-|\*)\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(line.replace(/^\d+\.\s+/, "")); continue; }
    if (/^---+$/.test(line)) { flushAll(); continue; }
    flushL();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

const pages = fs.readdirSync(TD).filter((f) => /^\d{2}\.md$/.test(f)).sort();
const sections = [];
for (const f of pages) {
  const nn = f.slice(0, 2);
  const md = fs.readFileSync(path.join(TD, f), "utf8");
  const cap = CAPTIONS[nn] || "";
  sections.push(
    `<figure>\n<img src="../${IMG}/${nn}.jpg" alt="风声再临规则书扫描图 ${nn}" loading="lazy">\n<figcaption>扫描图 ${nn} · ${cap}</figcaption>\n</figure>\n\n` +
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
  ["trajan", "🦅 图拉真"], ["tulip-bubble", "🌷 郁金香泡沫"],
  ["vale-of-eternity", "✨ 永恒之谷"], ["wingspan", "🦜 展翅翱翔"],
];
const navLis = NAV.map(([slug, label]) => `          <li><a href="${slug}.html">${label}</a></li>`).join("\n");

const DESC = "《风声再临》(The Message)中文规则书全文转录:Tobey Ho 设计,千骐动漫出版,3–7 人谍战阵营推理游戏。军情/潜伏/特工三方身份博弈,基础牌 87 张的情报传递、截获与烧毁,25 名角色隐藏/暴露双态技能与游戏用语概念说明,规则书扫描图随文嵌入。";
const TITLE = "风声再临 (The Message) · 规则 — 桌游规则书";
const URL = "https://zhibinai.cn/games/the-message.html";

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="${DESC}">
  <title>${TITLE}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🕵️</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="canonical" href="${URL}">
  <meta property="og:site_name" content="桌游规则书">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${TITLE}">
  <meta property="og:description" content="${DESC}">
  <meta property="og:url" content="${URL}">
  <meta property="og:image" content="https://zhibinai.cn/${IMG}/01.jpg">
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
   "primaryImageOfPage": { "@type": "ImageObject", "url": "https://zhibinai.cn/${IMG}/01.jpg" }
  },
  {
   "@type": "BreadcrumbList",
   "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "首页", "item": "https://zhibinai.cn/" },
    { "@type": "ListItem", "position": 2, "name": "风声再临 (The Message)", "item": "${URL}" }
   ]
  }
 ]
}</script>
  <!-- seo-wired -->
</head>
<body data-theme="message" data-game-key="the-message">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">风声再临</span>
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
          <h1 class="game-title">🕵️ 风声再临</h1>
          <p class="game-sub">The Message · 设计:Tobey Ho · 千骐动漫出版 · 3–7 人 · 谍战阵营推理(简体中文规则书全文转录)</p>
          <div class="meta-chips">
            <a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/67919" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 7.0，排名 #5587，权重/复杂度 2.39/5（1 轻松 ~ 5 重度），592人评分。点击查看原页面">⭐ BGG 7.0 · 排名 #5587 · 权重 2.39/5 · 592人评分</a>
            <span class="meta-chip">👥 3–7 人</span>
            <span class="meta-chip">⏱️ 30–60 分钟左右</span>
            <span class="meta-chip">📖 简体中文规则书全文转录</span>
            <span class="meta-chip">🕵️ 谍战 · 阵营推理 · 身份隐藏</span>
            <span class="meta-chip">🎭 25 名角色技能全收录</span>
          </div>
        </header>

<blockquote>
<p>本页整理自<a href="https://www.gstonegames.com/game/doc-859.html" target="_blank" rel="noopener">集石《风声再临》词条所载中文规则书</a>(来源标注:出版商,2018-12-30 发布)扫描件,共 17 页逐页全文转录,扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Tobey Ho、千骐动漫及版权方所有,转录仅供个人学习查阅。</p>
<p><small>整理说明:原文将简介页连贴两次,本页已去重,全书 17 页按序收录;原书个别页脚印有页码(较本页图序大 1,系实体书扉页未随文发布所致)。简体原样照录、未作繁简转换;卡牌美术字卡名为繁体(識破、調包、機密文件、戴笠、刀鋒、小馬哥、貝雷帽、福爾摩斯、情報處長、禮服蒙面、職業殺手等),照原样保留;卡面图样小字以引用块照录,与主栏正文的细微差异系原书即有;卡面竖排装饰小字在扫描分辨率下无法辨认处以〔?〕标注,未按常识补全;「选择N张手牌跟原情报洗混」「所指指定的玩家关系将在游戏中一直存在。」等原书措辞均照录。</small></p>
</blockquote>

${sections.join("\n\n")}

        <footer class="source-note">
<p>来源:<a href="https://www.gstonegames.com/game/doc-859.html" target="_blank" rel="noopener">集石《风声再临》非官方中文规则书</a>(来源标注:出版商)· 规则内容归 Tobey Ho、千骐动漫及版权方所有,转录仅供个人学习查阅。</p>
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

const outPath = path.join(ROOT, "games", "the-message.html");
fs.writeFileSync(outPath, html);
console.log("written", outPath, (html.length / 1024).toFixed(0) + "KB", "pages:", pages.length);
