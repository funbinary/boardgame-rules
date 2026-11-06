// 把 content/_transcripts/harmonies/ 下的 7 页译文装配为 games/harmonies.html
// 《自然和弦》(Harmonies) 官方英文规则书全文翻译(Libellud, 2024)
// 用法: node tools/assemble-harmonies.mjs
//   之后依次: node tools/sync-sidebar.mjs && node tools/wire-seo.mjs && node tools/wire-i18n.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sidebarGames } from "./lib/site-games.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "harmonies");
const OUT = path.join(ROOT, "games", "harmonies.html");
const IMG = "../assets/img/harmonies";
const SELF = "harmonies.html";
const PAGE_COUNT = 7;

// 每页插图题注(PDF 共 7 页:封面 + 5 个跨页 + 封底,对应小册子 12 页)
const CAPTIONS = {
  1: "封面 · HARMONIES 自然和弦 · Johan Benvenuto 设计 · Libellud 出版",
  2: "游戏目标 · 游戏组件(A–J 标注)· 设置 6 步(小册子第 2–3 页)",
  3: "回合流程 · 拿取并放置板块 · 如何放置板块(叠放高度图解)· 拿取 1 张动物卡 · 动物卡说明(小册子第 4–5 页)",
  4: "放置 1 个动物方块(Pauline 示例 ①–⑨)· 朝向 · 组合 · 游戏结束(小册子第 6–7 页)",
  5: "计分:树 / 山 / 田野 / 建筑 / 河流(A 面)· 岛屿(B 面)· 动物卡 · 总示例 116 分(小册子第 8–9 页)",
  6: "自然之灵卡 · 单人模式与太阳换算表(小册子第 10–11 页)",
  7: "封底 · 玩家帮助速查表(小册子第 12 页)",
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
  out = out.replace(/〔(图[:：]|图 |示例[:：]|图例[:：])([^〕]*)〕/g, "<em>〔$1$2〕</em>");
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
      out.push("<ol>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "</ol>");
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="自然和弦规则书第 ${n} 页" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页为《自然和弦》(Harmonies,Johan Benvenuto 设计,Libellud 出版)的官方英文规则书(LIBELLUD_HARMONIES_RULES_EN,PDF 7 页 = 小册子 12 页)全文翻译,底本为出版社经 BoardGameGeek Files 区发布的官方规则书 PDF,逐页全文译出,原书页面图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Libellud 及版权方所有,译文仅供个人学习查阅。</p>
<p><small>整理说明:〔图:……〕表示此处为印刷插图/图形符号,非正文文字;〔示例:……〕为原书示例栏的整理标题。术语译法对照(首现括注英文):景观=Landscape、栖息地=Habitat、板块=Token(灰=山石/蓝=水/棕=树干/绿=树冠/黄=田野/红=建筑)、动物方块=Animal cube、动物卡=Animal card、自然之灵=Nature's Spirit(卡/方块)、中央版图=Central board、个人版图=Personal board、提示卡=Reminder card、布袋=Pouch、计分纸本=Scoresheet pad、树=Tree、山=Mountain、田野=Field、建筑=Building、河流=River、岛屿=Island、太阳=Sun(单人模式)。原书 PDF 自带完整文字层,转录以文字层为源;计分表、太阳换算表等纯图形数字经多轮裁剪放大视觉转录与 OCR 坐标双源核验(树/山 1·3·7、河 0/2/5/8/11/15/+4、太阳 40–160→1–8);组件清单加和自洽(23+23+21+19+19+15=120 板块);示例分数 53+63=116、53+77=130 均与原书一致。译文中数字与数量均照原书逐项核对,未按游戏常识修正。</small></p>
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
  <meta name="description" content="《自然和弦》(Harmonies)官方英文规则书全文翻译:放置彩色板块构建山、树、田野、建筑与河流景观,为动物拼出栖息地图案并放置动物方块;回合三行动、叠放规则、朝向与组合、六类景观计分(树/山/田/建筑/河流/岛屿)、动物卡计分、自然之灵卡与单人模式太阳换算表,规则书页面图随文嵌入。">
  <title>自然和弦 (Harmonies) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🦁</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="harmonies" data-game-key="harmonies">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">自然和弦</span>
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
          <h1 class="game-title">🦁 自然和弦</h1>
          <p class="game-sub" data-zh="Harmonies · 设计:Johan Benvenuto · Libellud 出版 · 1–4 人 · 约 30–45 分钟 · 景观拼放(官方英文规则书全文翻译)" data-en="Harmonies · Designed by Johan Benvenuto · Published by Libellud · 1–4 Players · 30–45 min · Landscape building (official English rulebook with full Chinese translation)">Harmonies · 设计:Johan Benvenuto · Libellud 出版 · 1–4 人 · 约 30–45 分钟 · 景观拼放(官方英文规则书全文翻译)</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">🌄 景观拼放 · 含单人模式</span>
            <span class="meta-chip">🦁 动物栖息地 · 自然之灵</span>
            <span class="meta-chip">📖 英文规则书全文翻译</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源:Libellud 官方英文规则书(LIBELLUD_HARMONIES_RULES_EN.pdf)· 原文见 <a href="https://boardgamegeek.com/filepage/276502/official-harmonies-rulebook" target="_blank" rel="noopener">BoardGameGeek Files:Official Harmonies rulebook</a>· <a href="https://boardgamegeek.com/boardgame/414317/harmonies" target="_blank" rel="noopener">BGG 词条页</a>· 译文仅供个人学习查阅,规则内容归 Libellud 及版权方所有。</p>
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
