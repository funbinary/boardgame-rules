// 准备机器翻译任务清单：40 个有中文名、尚无中文正文的游戏 → _bga/mt-jobs.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "_bga", "raw");

const nameZh = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "bga-names-zh.json"), "utf8"));
const handDone = fs.readdirSync(path.join(ROOT, "content", "bga-zh"))
  .filter(f => f.endsWith(".html")).map(f => f.replace(".html", ""));

// 与 build 相同的清理逻辑
function cleanHtml(html, titleToId) {
  let h = html;
  h = h.replace(/<div[^>]*id="toc"[\s\S]*?<\/nav>|<div[^>]*id="toc"[\s\S]*?<!--[\s\S]*?-->\s*<\/div>/g, "");
  h = h.replace(/<span class="mw-editsection"[\s\S]*?<\/span>/g, "");
  h = h.replace(/<!--[\s\S]*?-->/g, "");
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, inner) => {
    const hrefM = attrs.match(/href="([^"]*)"/);
    if (!hrefM) return inner;
    let href = decodeURIComponent(hrefM[1].replace(/&amp;/g, "&"));
    if (/^\/Gamehelp/i.test(href)) {
      const id = titleToId.get("Gamehelp" + href.slice(9));
      return id ? `<a href="${id}.html">${inner}</a>` : inner;
    }
    if (/^\/(index\.php|wiki|#)/i.test(href) || /redlink=1/.test(href) || /^\/#/.test(href)) return inner;
    if (/^\/(File|Image):/i.test(href)) return inner;
    if (href.startsWith("//")) href = "https:" + href;
    else if (href.startsWith("/")) href = "https://en.doc.boardgamearena.com" + href;
    return `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;
  });
  h = h.replace(/<img\b([^>]*)>/gi, (m, attrs) => {
    const srcM = attrs.match(/src="([^"]*)"/);
    if (!srcM) return "";
    let src = decodeURIComponent(srcM[1].replace(/&amp;/g, "&"));
    if (src.startsWith("//")) src = "https:" + src;
    else if (src.startsWith("/")) src = "https://en.doc.boardgamearena.com" + src;
    const rel = src.replace("https://en.doc.boardgamearena.com", "");
    const rest = attrs.replace(/\s(src|srcset|width|height)="[^"]*"/g, "").replace(/\sclass="[^"]*"/g, "");
    return `<img src="${src}" loading="lazy" ${rest}>`;
  });
  h = h.replace(/\ssrcset="[^"]*"/g, "");
  return h;
}

// 读取 raw，重建 title→id 映射
const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith(".json"));
const byTitle = new Map();
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"));
    const t = d.parse?.title;
    if (t && d.parse?.text?.["*"] && !byTitle.has(t)) byTitle.set(t, d.parse.text["*"]);
  } catch {}
}
const titleToId = new Map();
for (const t of byTitle.keys()) titleToId.set(t, t.replace(/^Gamehelp/i, ""));

// 分块：块级标签边界切，≤950 字符；超长的再按任意闭合标签边界二次切
function chunkHtml(html) {
  const parts = html.split(/(?=<(?:h1|h2|h3|h4|p|ul|ol|table|dl|blockquote|figure|div)\b)/i).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if (cur.length + p.length > 950 && cur) { chunks.push(cur); cur = ""; }
    if (p.length > 950) {
      let sub = "";
      for (const row of p.split(/(?=<tr\b)/i)) {
        if (sub.length + row.length > 950 && sub) { chunks.push(sub); sub = ""; }
        sub += row;
      }
      cur = sub;
    } else cur += p;
  }
  if (cur) chunks.push(cur);

  // 二次切：任何超 950 的块，按闭合标签边界拆分
  const out = [];
  const hardSplit = (s) => {
    // 三段切：在安全的标签边界（> 之后）或文本空格处切开
    const pieces = [];
    let rest = s;
    while (rest.length > 850) {
      let cut = rest.lastIndexOf(">", 850);
      if (cut < 200) cut = rest.lastIndexOf(" ", 850);
      if (cut < 200) cut = 850;
      pieces.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    pieces.push(rest);
    return pieces;
  };
  for (const c of chunks) {
    if (c.length <= 950) { out.push(c); continue; }
    let s = "";
    for (const seg of c.split(/(?<=<\/(?:li|p|h[1-6]|tr|td|th|table|ul|ol|div|blockquote|caption|dt|dd)>)/i)) {
      if (seg.length > 950) {
        if (s) { out.push(s); s = ""; }
        out.push(...hardSplit(seg));
      } else {
        if (s.length + seg.length > 950 && s) { out.push(s); s = ""; }
        s += seg;
      }
    }
    if (s) out.push(s);
  }
  return out;
}

const jobs = [];
for (const [title, html] of byTitle) {
  const id = titleToId.get(title);
  if (!nameZh[id] || handDone.includes(id)) continue; // 只要首页展示的 47 个，排除已手翻
  const clean = cleanHtml(html, titleToId);
  const chunks = chunkHtml(clean);
  jobs.push({ id, chunks: chunks.map((t, i) => ({ k: id + ":" + crypto.createHash("md5").update(t).digest("hex").slice(0, 12), t })) });
}

fs.writeFileSync(path.join(ROOT, "_bga", "mt-jobs.json"), JSON.stringify(jobs));
const total = jobs.reduce((s, j) => s + j.chunks.length, 0);
console.log(`任务：${jobs.length} 个游戏，共 ${total} 个分块`);
