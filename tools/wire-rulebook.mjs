// 规则书页全站接线：site-games.json 注册 + index featured 注入 + style.css 主题色
// 用法: node tools/wire-rulebook.mjs <slug> [slug2 ...] | --all
// 之后由调用方依次跑: sync-sidebar -> wire-seo -> wire-i18n -> gen-sitemap -> check-seo
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RB = path.join(ROOT, "_bgg", "rulebooks");
const CATALOG = JSON.parse(fs.readFileSync(path.join(RB, "catalog.json"), "utf8"));

const argv = process.argv.slice(2);
const all = argv.includes("--all");
const slugs = all ? CATALOG.games.map(g => g.slug) : argv.filter(a => !a.startsWith("--"));
if (!slugs.length) { console.error("用法: node tools/wire-rulebook.mjs <slug>... | --all"); process.exit(1); }

/* 主题色与 assemble-rulebook.mjs 同算法 */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = x => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/* ---------- 1. site-games.json ---------- */
const regPath = path.join(ROOT, "content", "site-games.json");
const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
const bySlug = new Map(reg.games.map(g => [g.slug, g]));
let regAdded = 0;
for (const slug of slugs) {
  const c = CATALOG.games.find(x => x.slug === slug);
  if (!c) { console.error(`catalog 无 ${slug}`); continue; }
  if (bySlug.has(slug)) { continue; }
  reg.games.push({
    slug,
    zh: c.zh,
    en: `${c.en} · 官方英文规则书全文翻译`,
    players: (c.players || "").replace(/[–—]/g, "-"),
    href: `games/${slug}.html`,
    emoji: c.emoji || "📖",
  });
  reg.featuredOrder.push(slug);
  regAdded++;
}
if (regAdded) {
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");
  console.log(`site-games.json: +${regAdded}`);
} else console.log("site-games.json: 无新增");

/* ---------- 2. index.html featured 注入 ---------- */
const idxPath = path.join(ROOT, "index.html");
let idx = fs.readFileSync(idxPath, "utf8");
let idxAdded = 0;
for (const slug of slugs) {
  const c = CATALOG.games.find(x => x.slug === slug);
  if (!c) continue;
  if (idx.includes(`"${slug}"`)) continue; // 已注入
  const entry = `      { name: ${JSON.stringify(c.zh)}, en: ${JSON.stringify(c.en + " · 英文规则书全文翻译")}, id: "${slug}", players: "${(c.players || "").replace(/[–—]/g, "-")}", href: "games/${slug}.html" },\n`;
  idx = idx.replace("    var featured = [\n", "    var featured = [\n" + entry);
  idxAdded++;
}
if (idxAdded) {
  fs.writeFileSync(idxPath, idx);
  console.log(`index.html featured: +${idxAdded}`);
} else console.log("index.html: 无新增");

/* ---------- 3. style.css 主题色 ---------- */
const cssPath = path.join(ROOT, "assets", "css", "style.css");
let css = fs.readFileSync(cssPath, "utf8");
let cssAdded = 0;
for (const slug of slugs) {
  const c = CATALOG.games.find(x => x.slug === slug);
  if (!c) continue;
  if (css.includes(`data-theme="${slug}"`)) continue;
  const h = (c.rank * 47) % 360;
  const accent = hslToHex(h, 46, 40), strong = hslToHex(h, 46, 30);
  const r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
  const line = `body[data-theme="${slug}"] { --accent: ${accent}; --accent-strong: ${strong}; --accent-soft: rgba(${r}, ${g}, ${b}, 0.10); --accent-border: rgba(${r}, ${g}, ${b}, 0.35); }\n`;
  // 插到最后一个 body[data-theme=...] 行之后
  const m = [...css.matchAll(/^body\[data-theme=[^\]]+\] \{[^\n]*\}$/gm)];
  if (m.length) {
    const at = m[m.length - 1].index + m[m.length - 1][0].length;
    css = css.slice(0, at) + "\n" + line.trimEnd() + css.slice(at);
  } else css += "\n" + line;
  cssAdded++;
}
if (cssAdded) {
  fs.writeFileSync(cssPath, css);
  console.log(`style.css 主题: +${cssAdded}`);
} else console.log("style.css: 无新增");
