// 通用规则书页装配：_bgg/rulebooks/<slug>/{zh.md,en.md,extract-report.json} + catalog.json 条目
//   -> games/<slug>.html + assets/i18n/rulebooks/<slug>.en.html
// 用法: node tools/assemble-rulebook.mjs <slug> [slug2 ...] | --all
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sidebarGames } from "./lib/site-games.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RB = path.join(ROOT, "_bgg", "rulebooks");
const CATALOG = JSON.parse(fs.readFileSync(path.join(RB, "catalog.json"), "utf8"));

const argv = process.argv.slice(2);
const all = argv.includes("--all");
const slugs = all ? CATALOG.games.map(g => g.slug) : argv.filter(a => !a.startsWith("--"));

/* ---------- markdown -> html（与 assemble-white-castle-matcha.mjs 同套，去图版） ---------- */
function inline(s) {
  let out = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  return out;
}
function mdToHtml(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let __guard = 0;
  while (i < lines.length) {
    if (++__guard > 500000) throw new Error(`mdToHtml 死循环 line ${i}: ${JSON.stringify(lines[i].slice(0, 100))}`);
    const line = lines[i];
    if (!line.trim() || /^<!--page:\d+-->$/.test(line.trim())) { i++; continue; }
    if (/^#{1,6} /.test(line)) {
      const level = Math.max(2, Math.min(4, line.match(/^#+/)[0].length));
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
        if (/^\s{2,}[-*]\s+/.test(lines[i]) && items.length) {
          const sub = [];
          while (i < lines.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
            sub.push(lines[i].replace(/^\s{2,}[-*]\s+/, ""));
            i++;
          }
          items[items.length - 1] += "\n<ul>\n" + sub.map(s => `  <li>${inline(s)}</li>`).join("\n") + "\n</ul>";
          continue;
        }
        if (/^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*[-*]\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      out.push("<ul>\n" + items.map(it => `  <li>${inline(it)}</li>`).join("\n") + "\n</ul>");
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
      out.push("<ol>\n" + items.map(it => `  <li>${inline(it)}</li>`).join("\n") + "\n</ol>");
      continue;
    }
    if (/^\|/.test(line)) { // markdown 表格行 -> 保留为段落文本（简化处理）
      out.push(`<p>${inline(line.trim())}</p>`);
      i++; continue;
    }
    out.push(`<p>${inline(line.trim())}</p>`);
    i++;
  }
  return out.join("\n\n");
}

/* ---------- 主题色：rank 驱动的确定性 HSL ---------- */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
function themeColors(rank) {
  const h = (rank * 47) % 360, s = 46, l = 40;
  const accent = hslToHex(h, s, l);
  const strong = hslToHex(h, s, l - 10);
  const r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
  return { accent, strong, soft: `rgba(${r}, ${g}, ${b}, 0.10)`, border: `rgba(${r}, ${g}, ${b}, 0.35)` };
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function buildOne(g) {
  const dir = path.join(RB, g.slug);
  const zhMd = fs.readFileSync(path.join(dir, "zh.md"), "utf8");
  const enMd = fs.readFileSync(path.join(dir, "en.md"), "utf8");
  const rep = JSON.parse(fs.readFileSync(path.join(dir, "extract-report.json"), "utf8"));

  // 原书页面图：assets/img/<slug>/NN.webp 存在则按页穿插
  const imgDir = path.join(ROOT, "assets", "img", g.slug);
  const hasPageImg = n => fs.existsSync(path.join(imgDir, String(n).padStart(2, "0") + ".webp"));
  const figure = n => `<figure>\n<img src="../assets/img/${g.slug}/${String(n).padStart(2, "0")}.webp" alt="${g.en} rulebook page ${n}" loading="lazy">\n<figcaption>原版规则书 · 第 ${n} 页（点击图片放大）</figcaption>\n</figure>`;

  // 版式：原书页图为主体，每页下方折叠「AI 机翻对照」（默认收起，页面清爽）
  const fold = (n, body, label) => body && body.trim()
    ? `<details class="mt-fold">\n<summary>${label}</summary>\n<div class="mt-body">${body}</div>\n</details>`
    : "";

  const pageMap = md => {
    const byPage = new Map();
    let pre = "";
    for (const part of md.split(/(?=<!--page:\d+-->)/).filter(p => p.trim())) {
      const m = part.match(/<!--page:(\d+)-->/);
      if (!m) { pre = part; continue; }
      byPage.set(+m[1], (byPage.get(+m[1]) || "") + "\n\n" + part);
    }
    return { byPage, pre };
  };

  const buildFlow = (md, preLabel, pageLabel) => {
    const { byPage, pre } = pageMap(md);
    const out = [];
    if (pre.trim()) out.push(`<details class="mt-fold">\n<summary>${preLabel}</summary>\n<div class="mt-body">${mdToHtml(pre)}</div>\n</details>`);
    for (let n = 1; n <= rep.pages; n++) {
      const fig = hasPageImg(n) ? figure(n) : "";
      const body = mdToHtml(byPage.get(n) || "");
      out.push((fig ? fig + "\n\n" : "") + fold(n, body, pageLabel(n)));
    }
    for (const [n, md2] of byPage) if (n > rep.pages) out.push(fold(n, mdToHtml(md2), pageLabel(n)));
    return out.filter(Boolean).join("\n\n");
  };

  const anyImg = fs.existsSync(imgDir) && fs.readdirSync(imgDir).some(f => f.endsWith(".webp"));

  const zhHtml = buildFlow(zhMd, "📝 开篇 AI 机翻对照（点击展开）", n => `📝 第 ${n} 页 AI 机翻对照（点击展开）`);
  const enHtml = buildFlow(enMd, "📝 Preface notes (click to expand)", n => `📝 Page ${n} · original text (click to expand)`);

  const byline = [
    g.en,
    g.designer && !g.designer.includes("待核实") ? `设计：${g.designer}` : "",
    g.publisher && g.publisher !== "传统规则" ? `${g.publisher} 出版` : "",
    g.players ? `${g.players} 人` : "",
    `官方英文规则书全文翻译（${rep.pages} 页 · AI 辅助机翻）`,
  ].filter(Boolean).join(" · ");

  const chips = [
    g.players ? `<span class="meta-chip">👥 ${g.players} 人</span>` : "",
    ...((g.keywords || []).map(k => `<span class="meta-chip">${esc(k)}</span>`)),
    `<span class="meta-chip">📖 官方英文规则书全文翻译</span>`,
  ].filter(Boolean).join("\n            ");

  const sourceUrl = g.pdf_url || "";
  const sourceLabel = g.source_label || "官方规则书";
  const pdfName = (g.pdf_name || "rules.pdf");
  const sourceLink = sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(sourceLabel)}</a>` : esc(sourceLabel);

  const parts = [];
  parts.push(`<blockquote>
<p>本页收录《${g.zh}》（${g.en}${g.year ? ", " + g.year : ""}）的<strong>原版官方规则书全部 ${rep.pages} 页</strong>（底本：${sourceLink}，${pdfName}），逐页随图排列，<strong>点击任意图片即可放大查看</strong>；每页下方默认折叠了该页的 AI 辅助中文机翻对照，需要时可展开。规则内容归 ${esc(g.publisher || "版权方")} 及版权方所有，收录仅供个人学习查阅。</p>
<p><small>整理说明：机翻对照按本站术语口径对齐（牌库/手牌/回合/轮/板块/指示物等），PDF 图文混排页的语序可能与原书视觉顺序略有出入；规则细节请一律以页面上方原书页面为准。</small></p>
</blockquote>`);
  parts.push(zhHtml);

  const SIDEBAR = sidebarGames().filter(([href]) => href !== g.slug + ".html");
  const desc = `《${g.zh}》（${g.en}）官方英文规则书全文中文翻译：${(g.keywords || []).join(" · ")}，${rep.pages} 页整本译出，含设置、流程、计分与附录，附官方原文 PDF 链接。`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="${esc(desc)}">
  <title>${esc(g.zh)} (${esc(g.en)}) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>${g.emoji || "📖"}</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="${g.slug}" data-game-key="${g.slug}">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">${esc(g.zh)}</span>
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
${SIDEBAR.map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article data-page-lang="zh" data-alt-body="../assets/i18n/rulebooks/${g.slug}.en.html">
        <header class="page-header">
          <h1 class="game-title" data-zh="${esc(g.emoji + " " + g.zh)}" data-en="${esc(g.emoji + " " + g.en)}">${esc(g.emoji + " " + g.zh)}</h1>
          <p class="game-sub" data-zh="${esc(byline)}" data-en="${esc(g.en + " · Official English rulebook · " + rep.pages + " pages")}" >${esc(byline)}</p>
          <div class="meta-chips">
            ${chips}
          </div>
        </header>

        <div class="rule-body">
${parts.join("\n\n")}
        </div>

        <footer class="source-note">
<p>来源：${sourceLink}（${g.year || ""} ${pdfName}）· 译文仅供个人学习查阅，规则内容归 ${esc(g.publisher || "版权方")} 及版权方所有 · 原文版權與商标归原出版方。</p>
</footer>
      </article>
    </main>
  </div>

  <button class="to-top" aria-label="返回顶部">↑</button>
  <script src="../assets/js/i18n.js"></script>
  <script src="../assets/js/main.js"></script>
</body>
</html>
`;

  const outFile = path.join(ROOT, "games", g.slug + ".html");
  fs.writeFileSync(outFile, html);

  // EN 片段（i18n 切英文时按需 fetch）
  const i18nDir = path.join(ROOT, "assets", "i18n", "rulebooks");
  fs.mkdirSync(i18nDir, { recursive: true });
  const enFrag = `<div class="mw-parser-output">\n${enHtml}\n</div>`;
  fs.writeFileSync(path.join(i18nDir, g.slug + ".en.html"), enFrag);

  console.log(`✓ ${g.slug}: games/${g.slug}.html (${(fs.statSync(outFile).size / 1024).toFixed(0)}KB) + en 片段 (${(enFrag.length / 1024).toFixed(0)}KB)`);
}

if (!slugs.length) { console.error("用法: node tools/assemble-rulebook.mjs <slug>... | --all"); process.exit(1); }
let built = 0, skipped = 0;
for (const slug of slugs) {
  const g = CATALOG.games.find(x => x.slug === slug);
  if (!g) { console.error(`catalog 无 ${slug}`); continue; }
  try {
    buildOne(g);
    built++;
  } catch (e) {
    skipped++;
    console.error(`✗ ${slug}: ${e.message}`);
  }
}
console.log(`装配完成 ${built}，跳过/失败 ${skipped}`);
