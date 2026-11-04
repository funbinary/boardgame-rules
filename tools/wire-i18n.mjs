// 给手写独立规则页 games/*.html 接入中英切换(与 build-bga.mjs 生成的 BGA 页同款机制)
// 幂等:重复运行不产生重复属性/标签;注册表查不到英文名时跳过该条 data-en 并告警
// 根页面 index.html / bgg-ranking.html / account.html 为一次性手写,未纳入本脚本
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_DIR = path.join(ROOT, "games");

const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "site-games.json"), "utf8"));
// href(去掉 games/ 前缀) -> 注册表条目,供侧栏链接按 href 反查英文名
const byHref = new Map();
for (const g of registry.games || []) {
  byHref.set(String(g.href || "").replace(/^games\//, ""), g);
}

const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s);

// 注册表 en 字段常带中文说明后缀(如 "Puerto Rico · 完整规则书"),切成纯英文名
function enClean(en) {
  let s = String(en || "");
  s = s.replace(/[（(][^()（）]*[\u4e00-\u9fff][^()（）]*[)）]/g, "").trim(); // (扩展) 之类中文括注
  s = s.split(/\s*·\s*/).filter((part) => !/[\u4e00-\u9fff]/.test(part)).join(" · ").trim();
  return s;
}

// 元素文本 "🏛️ 七大奇迹" -> 英文侧保留 emoji 前缀 + 英文名
function withEmojiPrefix(text, en) {
  const m = text.match(/^([^\u4e00-\u9fffA-Za-z0-9]*)([\s\S]*)$/);
  return (m ? m[1] : "") + en;
}

// 从 HTML 源捕获的文本可能带实体(如 "&amp;"),先解码为纯文本再 escAttr,
// 否则属性值会变成字面 "&amp;"——i18n.js 用 textContent 回填时会原样显示。
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// 在标签字符串(以 > 结尾)末尾追加属性;已有同名属性则原样返回
function setAttr(tag, name, value) {
  if (new RegExp(`\\s${name}=`).test(tag)) return tag;
  return tag.slice(0, -1) + ` ${name}="${escAttr(value)}">`;
}

function wireFile(file) {
  const full = path.join(GAMES_DIR, file);
  let html = fs.readFileSync(full, "utf8");
  const reg = byHref.get(file);
  if (!reg) console.warn(`  ! ${file}: site-games.json 无条目,标题/侧栏英文名相关属性跳过`);
  const en = reg ? enClean(reg.en) : "";
  let changed = 0;
  const orig = html;

  // 1) <title> 双语
  html = html.replace(/<title>([^<]+)<\/title>/, (m, t) => {
    if (!en || /data-en=/.test(m)) return m;
    changed++;
    return `<title data-zh="${escAttr(decodeEntities(t))}" data-en="${escAttr(decodeEntities(en))} · Rules — Board Game Rules">${t}</title>`;
  });

  // 2) brand / menu-btn / to-top 的固定文案走字典
  html = html.replace(/<(a|span)([^>]*class="brand"[^>]*)>/, (m) => {
    const r = setAttr(m, "data-i18n", "brand");
    if (r !== m) changed++;
    return r;
  });
  html = html.replace(/<button([^>]*class="menu-btn"[^>]*)>/, (m) => {
    const r = setAttr(m, "data-i18n-aria", "openToc");
    if (r !== m) changed++;
    return r;
  });
  html = html.replace(/<button([^>]*class="to-top"[^>]*)>/, (m) => {
    const r = setAttr(m, "data-i18n-aria", "backTop");
    if (r !== m) changed++;
    return r;
  });

  // 3) 侧栏固定标题/导航 aria
  for (const [zh, key] of [["本页目录", "onThisPage"], ["全部游戏", "allGames"], ["站点导航", "siteNav"]]) {
    html = html.replace(`<div class="toc-title">${zh}</div>`, (m) => {
      changed++;
      return `<div class="toc-title" data-i18n="${key}">${zh}</div>`;
    });
    html = html.replace(new RegExp(`aria-label="${zh}"(?![^>]*data-i18n-aria)`), (m) => {
      changed++;
      return `aria-label="${zh}" data-i18n-aria="${key}"`;
    });
  }

  // 4) 侧栏游戏链接:data-zh=现文本 / data-en=注册表英文名(保留 emoji 前缀)
  html = html.replace(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g, (m, href, text) => {
    if (/data-(zh|en|i18n)=/.test(m)) return m;
    if (/返回首页|全部游戏/.test(text)) return m; // 固定项走字典(第 5 步)
    const key = href.replace(/^(\.\.\/)+/, "").replace(/^(\.\/)?games\//, "");
    const g = byHref.get(key);
    if (!g || !hasCJK(text)) return m;
    changed++;
    return `<li><a href="${href}" data-zh="${escAttr(decodeEntities(text))}" data-en="${escAttr(decodeEntities(withEmojiPrefix(text, enClean(g.en))))}">${text}</a></li>`;
  });

  // 5) 侧栏「返回首页」两种文案
  html = html.replace(/<li><a href="([^"]*)">([^<]*返回首页[^<]*)<\/a><\/li>/, (m, href, text) => {
    if (/data-i18n=/.test(m)) return m;
    changed++;
    const key = /全部游戏/.test(text) ? "homeAll" : "home";
    return `<li><a href="${href}" data-i18n="${key}">${text}</a></li>`;
  });

  // 6) h1 / topbar-title 双语(emoji 前缀保留)
  if (en) {
    html = html.replace(/<h1 class="game-title">([^<]+)<\/h1>/, (m, t) => {
      if (/data-en=/.test(m) || !hasCJK(t)) return m;
      changed++;
      return `<h1 class="game-title" data-zh="${escAttr(decodeEntities(t))}" data-en="${escAttr(decodeEntities(withEmojiPrefix(t, en)))}">${t}</h1>`;
    });
    html = html.replace(/<span class="topbar-title">([^<]+)<\/span>/, (m, t) => {
      if (/data-en=/.test(m) || !hasCJK(t)) return m;
      changed++;
      return `<span class="topbar-title" data-zh="${escAttr(decodeEntities(t))}" data-en="${escAttr(decodeEntities(withEmojiPrefix(t, en)))}">${t}</span>`;
    });
  }

  // 7) game-sub 仅处理「X · 设计:Y」这类可机械翻译的,其余保持
  html = html.replace(/<p class="game-sub">([^<]+)<\/p>/, (m, t) => {
    if (/data-en=/.test(m)) return m;
    const mm = t.match(/^([^·]+) · 设计[:：]\s*(.+)$/);
    if (!mm) return m;
    changed++;
    return `<p class="game-sub" data-zh="${escAttr(decodeEntities(t))}" data-en="${escAttr(decodeEntities(mm[1].trim()))} · Design: ${escAttr(decodeEntities(mm[2].trim()))}">${t}</p>`;
  });

  // 8) article 标注正文语言(独立页正文为中文,无对侧片段,切英文时 i18n.js 显示提示条)
  if (html.includes("<article>")) {
    html = html.replace("<article>", `<article data-page-lang="zh">`);
    changed++;
  }

  // 9) 引入 i18n.js(在 main.js 之前)
  if (!html.includes("assets/js/i18n.js")) {
    html = html.replace(`<script src="../assets/js/main.js"></script>`, `<script src="../assets/js/i18n.js"></script>\n  <script src="../assets/js/main.js"></script>`);
    changed++;
  }

  if (html !== orig) fs.writeFileSync(full, html);
  return changed;
}

const files = fs.readdirSync(GAMES_DIR).filter((f) => f.endsWith(".html"));
let touched = 0;
for (const f of files) {
  const n = wireFile(f);
  if (n > 0) touched++;
}
console.log(`wire-i18n: 处理 ${files.length} 个独立页,本次修改 ${touched} 个(其余已是最新)`);
