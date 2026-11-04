// 把 content/_transcripts/white-castle-matcha/ 下的 16 页译文装配为 games/white-castle-matcha.html
// 《姬路城:茶道》(The White Castle: Matcha) 官方英文规则书全文翻译(BGG filepage/285723, Devir 官方)
// 用法: node tools/assemble-white-castle-matcha.mjs
//   之后依次: node tools/wire-seo.mjs && node tools/wire-i18n.mjs && node tools/sync-sidebar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sidebarGames } from "./lib/site-games.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "white-castle-matcha");
const OUT = path.join(ROOT, "games", "white-castle-matcha.html");
const IMG = "../assets/img/white-castle-matcha";
const SELF = "white-castle-matcha.html";
const PAGE_COUNT = 16;

// 每页插图题注
const CAPTIONS = {
  1: "封面 · The White Castle Matcha 姬路城:茶道 · 背景(茶道文化 · 茶室 Chashitsu) · 游戏配件总览",
  2: "游戏设置 · 扩展设置(绿色桥梁 · 池塘睡莲 · 插花/书法牌库 · 茶室与池畔眺台的仪式板块)",
  3: "游戏设置(续) · 起始卡与仪式板块 · 开始游戏(3 轮 × 每轮 4 回合)",
  4: "新游戏区域 · 绿色桥梁 · 茶田 · 姬路城郊外 · 个人领地",
  5: "茶田(艺伎行动) · 姬路城郊外(双帘幕行动) · 两处放置示例",
  6: "个人领地(绿色骰子行 · 仪式板块行动) · 艺伎与茶筅 · 大名家纹新用法",
  7: "艺伎行动 · 进入茶园 / 漫步茶之路 · 池畔眺台 · 姬路城郊外第一格(黄色帘幕)",
  8: "姬路城郊外第二格(蓝色帘幕) · 茶室三房间 · 绿色玩家示例",
  9: "行动示例(续) · 绿色玩家拿取插花卡 · 黄色玩家进入茶室房间",
  10: "回合结束(桥梁合计剩 4 骰触发) · 水池(睡莲奖励) · 游戏结束",
  11: "终局计分 · 剩余资源 / 时间流逝 / 家族成员 / 茶园艺伎计分 · 示例与胜负判定",
  12: "单人模式「德川家族的到访」 · 设置变更 · 茶之路特殊规则",
  13: "单人模式图标 · 4 个新图标及其连锁效果",
  14: "附录:仪式板块(一) · 10 种效果",
  15: "附录:仪式板块(二) · 10 种效果",
  16: "附录:抹茶图标 · 制作人员 · 作者致谢",
};

const STRIP_LINE = [/^# 规则书第 \d+ 页/, /^-{3,}$/];

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function preprocess(text) {
  const out = [];
  for (let line of text.split("\n")) {
    if (STRIP_LINE.some((re) => re.test(line))) continue;
    // 标题尾部的〔…〕说明拆为独立行,避免目录被污染
    const bm = line.match(/^(#{1,6} [^〔]*?)\s*〔(.+?)〕\s*$/);
    if (bm) {
      out.push(bm[1], "", `〔${bm[2]}〕`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inline(s) {
  let out = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/〔(图[:：]|图 |图标[:：])([^〕]*)〕/g, "<em>〔$1$2〕</em>");
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
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        if (/^\s*[-*]\s+/.test(lines[i])) {
          // 嵌套列表(两个空格缩进)
          if (/^\s{2,}[-*]\s+/.test(lines[i]) && items.length) {
            const sub = [];
            while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
              sub.push(lines[i].replace(/^\s{2,}[-*]\s+/, ""));
              i++;
            }
            items[items.length - 1] += "\n<ul>\n" + sub.map((s) => `  <li>${inline(s)}</li>`).join("\n") + "\n</ul>";
            continue;
          }
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
          i++; continue;
        }
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
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)[.、)]\s+(.*)$/);
        if (m) { items.push(m[2]); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*\d+[.、)]\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      out.push("<ol>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "\n</ol>");
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="姬路城:茶道规则书扫描图第 ${n} 张" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页为《姬路城:茶道》(The White Castle: Matcha,Sheila Santos 与 Israel Cendrero 设计,Devir Games 出版)扩展的官方英文规则书全文翻译,底本取自 <a href="https://boardgamegeek.com/filepage/285723/rulebook" target="_blank" rel="noopener">BoardGameGeek 文件区 Devir 官方英文规则书</a>(WhiteCastle_Matcha_ENG.pdf,16 页),逐页全文译出,原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Devir 及版权方所有,译文仅供个人学习查阅。</p>
<p><small>整理说明:〔图标:……〕表示此处为印刷图标/图形,非文字;〔引言:……〕〔示例:……〕〔图示:……〕为整理所拟;术语与本站《姬路城》官方中文规则书保持一致(大名家纹=Daimyo Seal、家族分数=Clan Point、地头/使节/大名=城堡一二三层、家臣/武士/园丁、灯笼奖励、时间流逝轨等);新增术语译法:艺伎=Geisha、茶筅=Chasen、茶园=Tea Garden、茶室=Tea House(Chashitsu)、茶之路=Path of Tea、池畔眺台=Pond Overlook、睡莲板块=Water Lily tiles、仪式板块=Ceremony tiles、插花卡/书法卡=Flower Arrangement/Calligraphy、姬路城郊外=Outskirts of Himeji。原书为纯图扫描件,转录经本地 OCR 与视觉模型双遍对照核验;译文中数字与费用均照原书逐项核对。</small></p>
</blockquote>`);

for (let n = 1; n <= PAGE_COUNT; n++) {
  if (n > 1) parts.push(figure(n));
  parts.push(mdToHtml(preprocess(readFrag(n))));
}

// 侧栏:注册表单一事实源
const SIDEBAR = sidebarGames();

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《姬路城：茶道》（The White Castle: Matcha）扩展官方英文规则书全文翻译：绿色桥梁与绿骰、茶田与姬路城郊外两个新地点、个人领地绿色行与仪式板块行动，新家族成员艺伎与新资源茶筅，漫步茶之路前往茶室三房间或池畔眺台，每轮 4 回合、桥梁合计剩 4 骰触发轮结束，终局茶园艺伎计分，单人模式「德川家族的到访」扩展图标，附录仪式板块 20 效与抹茶图标总表，规则书扫描图随文嵌入。">
  <title>姬路城：茶道 (The White Castle: Matcha) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🍵</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="matcha" data-game-key="white-castle-matcha">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">姬路城：茶道</span>
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
${SIDEBAR.filter(([href]) => href !== SELF).map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🍵 姬路城：茶道</h1>
          <p class="game-sub">The White Castle: Matcha · 设计：Sheila Santos &amp; Israel Cendrero · Devir Games 出版 · 1–4 人 · 约 90–110 分钟（官方英文规则书全文翻译）</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">🤖 含单人模式</span>
            <span class="meta-chip">🍵 绿色骰子 · 艺伎 · 茶筅</span>
            <span class="meta-chip">🎋 茶园 · 茶室 · 姬路城郊外</span>
            <span class="meta-chip">📖 英文规则书全文翻译</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：BoardGameGeek 文件区 <a href="https://boardgamegeek.com/filepage/285723/rulebook" target="_blank" rel="noopener">Devir 官方英文规则书</a>（The White Castle: Matcha, 2024）· 译文仅供个人学习查阅，规则内容归 Devir 及版权方所有 · 本体规则见<a href="white-castle.html">姬路城（官方中文规则书全文转录）</a>。</p>
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
