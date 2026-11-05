// 把 content/_transcripts/spirit-island/ 下的 32 页译文装配为 games/spirit-island.html
// 《灵迹岛》(Spirit Island) 官方英文规则书全文翻译(Greater Than Games, VER 23.08)
// 用法: node tools/assemble-spirit-island.mjs
//   之后依次: node tools/sync-sidebar.mjs && node tools/wire-seo.mjs && node tools/wire-i18n.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sidebarGames } from "./lib/site-games.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "spirit-island");
const OUT = path.join(ROOT, "games", "spirit-island.html");
const IMG = "../assets/img/spirit-island";
const SELF = "spirit-island.html";
const PAGE_COUNT = 32;

// 每页插图题注
const CAPTIONS = {
  1: "封面 · SPIRIT ISLAND 灵迹岛 · R. Eric Reuss 设计 · Greater Than Games 出版",
  2: "目录",
  3: "游戏简介 · 玩法概览 · 如何使用本规则书 · 首次游玩的玩家",
  4: "游戏组件(一) · 入侵者版图与版图区文字说明",
  5: "游戏组件(二) · 恐惧牌/枯萎牌/入侵者牌/力量牌/对手与情景面板",
  6: "游戏设置 · 入侵者版图 · 岛屿与补给区 · 玩家设置 · 入侵者的起始行动 · 构建入侵者牌堆",
  7: "4 人游戏完整设置全景图(不含对手与情景)",
  8: "回合流程 · 灵阶段 · 迅捷力量阶段 · 战争的紧迫/谁来做决定/聚拢与消灭示例",
  9: "入侵者阶段 · 枯萎岛屿 · 恐惧 · 肆虐 · 枯萎的效果(级联与消灭临在)",
  10: "建造 · 探索 · 推进入侵者牌 · 迟缓力量阶段 · 时光流逝 · 阶段二升级与阶段三",
  11: "肆虐示例 · 建造示例 · 探索示例",
  12: "胜利与失败 · 恐惧与恐怖等级 · 恐惧标记流转五步图",
  13: "板块与地块 · 临在与圣域 · 能量与出牌 · 沿海与内陆",
  14: "灵 · 灵面板解剖(9 要素) · 常见成长选项 · 元素阈值",
  15: "入侵者(探索者/城镇/城市) · 枯萎 · 伤害的记录(城镇与城市模型)",
  16: "达罕人 · 力量解剖(7 要素) · 八大元素",
  17: "元素阈值 · 三大通则(能做多少做多少/可以不使用力量/一个地块一个回合一次使用) · 单回合效果",
  18: "获得力量牌 · 伤害/消灭/移除/替换 · 防御 · 移除枯萎",
  19: "聚拢与推离 · 重复 · 聚拢与推离示例",
  20: "技巧与窍门 · Oops 搞砸了 · 让流程更顺畅",
  21: "基础策略 · 游戏太难",
  22: "玩法选项 · 单人模式 · 对手(勃兰登堡-普鲁士/英格兰/瑞典)",
  23: "情景 · 主题地图 · 主题板块设置 · 计分",
  24: "背景故事 · 迄今为止的故事(岛屿/灵/达罕人/两次清算/入侵者)",
  25: "插画页 · 岛屿巨灵",
  26: "敌人的进击 · 架空历史中的勃兰登堡-普鲁士/英格兰/瑞典",
  27: "插画页 · 公元 1700 年入侵者故土地图",
  28: "对手与情景难度表 · 制作名单",
  29: "设计笔记 · 试玩人员 · 画师",
  30: "术语表/索引(一)",
  31: "术语表/索引(二)",
  32: "图标参考 · 棋子/目标栏/射程/临在轨道图标 · 回合顺序总表",
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

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    // markdown 表格(| a | b | + 分隔行 | --- | --- |)
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        "<table>\n<thead>\n<tr>" + head.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr>\n</thead>\n<tbody>\n" +
        rows.map((r) => "<tr>" + head.map((_, ci) => `<td>${inline(r[ci] ?? "")}</td>`).join("") + "</tr>").join("\n") +
        "\n</tbody>\n</table>",
      );
      continue;
    }
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="灵迹岛规则书第 ${n} 页" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页为《灵迹岛》(Spirit Island,R. Eric Reuss 设计,Greater Than Games 出版)的官方英文规则书(版本 VER 23.08,32 页)全文翻译,底本为出版社官方发布之规则书 PDF,逐页全文译出,原书页面图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Greater Than Games / Flat River Group 及版权方所有,译文仅供个人学习查阅。</p>
<p><small>整理说明:〔图:……〕〔图标〕表示此处为印刷插图/图形符号,非正文文字;〔示例:……〕为原书示例栏的整理标题。术语译法对照(首现括注英文):灵=Spirit、达罕人=Dahan、入侵者=Invader(探索者=Explorer/城镇=Town/城市=City)、枯萎=Blight(级联=Cascade)、恐惧=Fear、恐怖等级=Terror Level、临在=Presence、圣域=Sacred Site、力量=Power(次要/主要/独特力量=Minor/Major/Unique Power、天赋力量=Innate Power、迅捷/迟缓=Fast/Slow)、成长=Growth、回收=Reclaim、肆虐=Ravage、建造=Build、探索=Explore、升级效果=Escalation、对手=Adversary、情景=Scenario、防御=Defend、聚拢=Gather、推离=Push、遗忘=Forget、重复=Repeat、元素=Element(日/月/火/风/水/土/植物/动物)、元素阈值=Elemental Threshold、射程=Range、沿海/内陆=Coastal/Inland、时光流逝=Time Passes。原书 PDF 自带完整文字层,转录以文字层为源、组件与图表页辅以视觉核对;难度表经文字坐标重建与视觉双源核验;译文中数字与数量均照原书逐项核对。</small></p>
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
  <meta name="description" content="《灵迹岛》（Spirit Island）官方英文规则书全文翻译：扮演自然之灵与达罕人携手对抗殖民入侵者，灵阶段成长/获得能量/打出力量牌，迅捷与迟缓力量、入侵者肆虐/建造/探索三行动，恐惧与恐怖等级三段胜利条件，枯萎级联与临在、圣域、元素阈值、聚拢与推离、对手（勃兰登堡-普鲁士/英格兰/瑞典）与情景、单人模式、主题地图、背景故事与设计笔记，规则书页面图随文嵌入。">
  <title>灵迹岛 (Spirit Island) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🏝️</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="spiritisland" data-game-key="spirit-island">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">灵迹岛</span>
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
          <h1 class="game-title">🏝️ 灵迹岛</h1>
          <p class="game-sub" data-zh="Spirit Island · 设计：R. Eric Reuss · Greater Than Games 出版 · 1–4 人 · 约 90–120 分钟 · 合作（官方英文规则书全文翻译）" data-en="Spirit Island · Designed by R. Eric Reuss · Published by Greater Than Games · 1–4 Players · 90–120 min · Cooperative (official English rulebook with full Chinese translation)">Spirit Island · 设计：R. Eric Reuss · Greater Than Games 出版 · 1–4 人 · 约 90–120 分钟 · 合作（官方英文规则书全文翻译）</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">🤝 合作 · 含单人模式</span>
            <span class="meta-chip">🌊 灵之力 · 恐惧 · 枯萎</span>
            <span class="meta-chip">📖 英文规则书全文翻译</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：Greater Than Games 官方英文规则书（Spirit Island Rulebook, VER 23.08, 32 页）· 原文见 <a href="https://boardgamegeek.com/boardgame/162886/spirit-island" target="_blank" rel="noopener">BoardGameGeek 词条页</a>与<a href="https://shop.greaterthangames.com/products/spirit-island" target="_blank" rel="noopener">官方商店</a> · 译文仅供个人学习查阅，规则内容归 Greater Than Games / Flat River Group 及版权方所有。</p>
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
