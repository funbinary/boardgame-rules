// 合并 url-research-*.json 的 pdf_url/source_label/status 到 _bgg/rulebooks/catalog.json
// 用法: node tools/merge-rulebook-sources.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RB = path.join(ROOT, "_bgg", "rulebooks");
const cat = JSON.parse(fs.readFileSync(path.join(RB, "catalog.json"), "utf8"));
const bySlug = new Map(cat.games.map(g => [g.slug, g]));

const files = fs.readdirSync(RB).filter(f => /^url-research-.*\.json$/.test(f));
let n = 0;
for (const f of files) {
  let rows;
  try { rows = JSON.parse(fs.readFileSync(path.join(RB, f), "utf8")); } catch (e) { console.error(`${f} 解析失败: ${e.message}`); continue; }
  for (const r of rows) {
    const g = bySlug.get(r.slug);
    if (!g) continue;
    g.pdf_url = r.pdf_url || g.pdf_url || "";
    g.source_label = r.source_label || g.source_label || "";
    g.pdf_status = r.status || g.pdf_status || "";
    g.pdf_name = (r.pdf_url && r.pdf_url.split("/").pop()) || g.pdf_name || "rules.pdf";
    if (r.publisher && r.publisher !== "...") g.publisher = r.publisher;
    if (r.notes) g.pdf_notes = r.notes;
    n++;
  }
}
fs.writeFileSync(path.join(RB, "catalog.json"), JSON.stringify(cat, null, 2) + "\n");
console.log(`合并 ${files.length} 份研究文件，更新 ${n} 条`);
const bad = cat.games.filter(g => !g.pdf_url);
if (bad.length) console.log("仍无 pdf_url:", bad.map(g => g.slug + "(" + (g.pdf_status || "?") + ")").join(", "));
