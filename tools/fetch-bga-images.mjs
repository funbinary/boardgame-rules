// 从 _bga/raw/ 收集所有图片 URL，下载到 assets/img/bga/（并发 6，可断点续传）
// 产出 _bga/images-map.json: wikiPath -> localRelPath（失败的条目不写入，构建时退回外链）
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "_bga", "raw");
const IMG_DIR = path.join(ROOT, "assets", "img", "bga");
fs.mkdirSync(IMG_DIR, { recursive: true });

const WIKI = "https://en.doc.boardgamearena.com";
const UA = "bgules-personal-site/1.0";

// 1) 收集全部图片路径
const urls = new Set();
for (const f of fs.readdirSync(RAW_DIR).filter(f => f.endsWith(".json"))) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"));
    const html = d.parse?.text?.["*"] || "";
    for (const m of html.matchAll(/<img[^>]*src="([^"]+)"/g)) {
      let src = decodeURIComponent(m[1].replace(/&amp;/g, "&"));
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) src = WIKI + src;
      if (src.startsWith(WIKI + "/images/")) urls.add(src);
    }
  } catch {}
}
console.log(`共 ${urls.size} 个图片 URL`);

// 2) 并发下载（跳过已有且非空文件）
const list = [...urls];
let done = 0, skipped = 0, failed = 0;
const map = {};
const CONCURRENCY = 6;

async function downloadOne(url) {
  const rel = url.slice(WIKI.length); // /images/x/xy/name.ext
  // 用 URL 的 md5 前 16 位做本地文件名：避免 Windows 260 字符路径超长问题
  const ext = (rel.match(/\.(\w{3,4})(?:\/|$)/) || [])[1] || "png";
  const base = crypto.createHash("md5").update(rel).digest("hex").slice(0, 16) + "." + ext;
  const local = path.join(IMG_DIR, base);
  if (fs.existsSync(local) && fs.statSync(local).size > 0) {
    map[rel] = "assets/img/bga/" + base;
    skipped++;
    return;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 50) throw new Error("too small");
      fs.writeFileSync(local, buf);
      map[rel] = "assets/img/bga/" + path.basename(local);
      done++;
      return;
    } catch (e) {
      if (attempt === 2) { failed++; console.log(`失败 ${url}: ${e.message}`); }
      else await new Promise(r => setTimeout(r, 800));
    }
  }
}

let idx = 0;
async function worker() {
  while (idx < list.length) {
    const u = list[idx++];
    await downloadOne(u);
    if ((done + skipped) % 100 === 0) console.log(`进度 ${done + skipped}/${list.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

fs.writeFileSync(path.join(ROOT, "_bga", "images-map.json"), JSON.stringify(map, null, 1));
console.log(`完成：本次下载 ${done}，已存在 ${skipped}，失败 ${failed}`);
