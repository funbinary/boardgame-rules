// 全站侧边栏统一:读 content/site-games.json 注册表,幂等重写全部 games/*.html 的
// 「全部游戏」nav 到 canonical 状态,并补注册表 crossLinks 声明的扩展互链。
// 取代历史上 12 个 wire-*-sidebar.mjs(插入式/重写式两代,各自携带过期清单快照)。
// 注意:本脚本重写 nav 为纯链接(不带 data-zh/data-en),跑完需再执行
//   node tools/wire-i18n.mjs   补回双语属性(幂等)。
// 用法: node tools/sync-sidebar.mjs   (注册表与 games/ 目录不一致、nav 未匹配 → 非零退出)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, sidebarGames } from "./lib/site-games.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIDEBAR = sidebarGames();

// 校验:侧边栏清单与 games/ 目录双向对齐(多文件/漏文件都算注册表失真,失败即停)
const files = fs.readdirSync(path.join(ROOT, "games")).filter((f) => f.endsWith(".html"));
const sidebarFiles = SIDEBAR.map(([href]) => href);
const missing = files.filter((f) => !sidebarFiles.includes(f));
const dangling = sidebarFiles.filter((f) => !files.includes(f));
if (missing.length || dangling.length) {
  if (missing.length) console.error(`注册表缺条目(games/ 有文件但侧边栏没有): ${missing.join(", ")}`);
  if (dangling.length) console.error(`注册表有死链(侧边栏有条目但文件不存在): ${dangling.join(", ")}`);
  process.exit(1);
}

// nav 开标签允许携带 wire-i18n 注入的 data-i18n-aria 等属性
const navRe = /(<nav aria-label="全部游戏"[^>]*>\s*<div class="toc-title"[^>]*>[^<]*<\/div>\s*<ul>\n)([\s\S]*?)(\n *<\/ul>)/;
let changed = 0;
let failed = 0;
for (const f of files) {
  const p = path.join(ROOT, "games", f);
  const html = fs.readFileSync(p, "utf8");
  if (!navRe.test(html)) {
    console.error(`${f}: 全部游戏 nav 未匹配!`);
    failed++;
    continue;
  }
  const items = SIDEBAR.filter(([href]) => href !== f)
    .map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`)
    .join("\n");
  const next = html.replace(navRe, `$1          <li><a href="../index.html">🏠 返回首页</a></li>\n${items}$3`);
  if (next !== html) {
    fs.writeFileSync(p, next);
    changed++;
    console.log(`${f}: sidebar updated`);
  }
}

// 扩展互链(幂等:marker 已存在则跳过)
const { reg } = loadRegistry();
for (const link of reg.crossLinks ?? []) {
  const p = path.join(ROOT, link.page);
  let html = fs.readFileSync(p, "utf8");
  if (html.includes(link.marker)) {
    console.log(`${link.page}: 互链已存在,跳过`);
    continue;
  }
  const anchor = new RegExp(link.anchor);
  if (!anchor.test(html)) {
    console.error(`${link.page}: 互链锚点未匹配!`);
    failed++;
    continue;
  }
  html = html.replace(anchor, `${link.inject}$1`);
  fs.writeFileSync(p, html);
  console.log(`${link.page}: 扩展互链已加`);
  changed++;
}

console.log(`\ncanonical = ${SIDEBAR.length} 条;${changed} 个文件更新${failed ? `;${failed} 个失败` : ""}`);
if (failed) process.exit(1);
