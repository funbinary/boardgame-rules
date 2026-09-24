// 生成 sitemap.xml：首页 + 中文规则页 + games/bga 全量页
// 用法：node tools/gen-sitemap.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://zhibinai.cn";

function entry(file, urlPath, priority) {
  const lastmod = fs.statSync(path.join(ROOT, file)).mtime.toISOString().slice(0, 10);
  return `  <url>\n    <loc>${BASE}${urlPath}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const urls = [];
urls.push(entry("index.html", "/", "1.0"));

const zhGames = fs
  .readdirSync(path.join(ROOT, "games"))
  .filter((f) => f.endsWith(".html"))
  .sort();
for (const f of zhGames) urls.push(entry(path.join("games", f), `/games/${f}`, "0.8"));

const bgaDir = path.join(ROOT, "games", "bga");
if (fs.existsSync(bgaDir)) {
  const bgaPages = fs.readdirSync(bgaDir).filter((f) => f.endsWith(".html")).sort();
  for (const f of bgaPages) urls.push(entry(path.join("games", "bga", f), `/games/bga/${f}`, "0.6"));
  console.log(`zh pages: ${zhGames.length}, bga pages: ${bgaPages.length}`);
}

// 在线玩页(play/<slug>/index.html,静态构建产物)
const playDir = path.join(ROOT, "play");
if (fs.existsSync(playDir)) {
  let playCount = 0;
  for (const d of fs.readdirSync(playDir).sort()) {
    const rel = path.join("play", d, "index.html");
    if (d.startsWith(".") || !fs.existsSync(path.join(ROOT, rel))) continue;
    urls.push(entry(rel, `/play/${d}/`, "0.8"));
    playCount++;
  }
  if (playCount) console.log(`play pages: ${playCount}`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
console.log(`sitemap.xml written: ${urls.length} URLs`);
