// 收集 _bga/mt-results.json 的译文，按游戏拼装写入 content/bga-zh/<id>.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobs = JSON.parse(fs.readFileSync(path.join(ROOT, "_bga", "mt-jobs.json"), "utf8"));
const results = JSON.parse(fs.readFileSync(path.join(ROOT, "_bga", "mt-results.json"), "utf8"));
const ZH_DIR = path.join(ROOT, "content", "bga-zh");
fs.mkdirSync(ZH_DIR, { recursive: true });

let written = 0, incomplete = [];
for (const game of jobs) {
  const parts = [];
  let missing = 0;
  for (const c of game.chunks) {
    const t = results[c.k];
    if (t) parts.push(t);
    else if (!c.t.trim()) parts.push(c.t); // 空白块直接保留
    else missing++;
  }
  if (parts.length === 0) { incomplete.push(game.id + "(全缺)"); continue; }
  if (missing > 0) incomplete.push(game.id + `(缺${missing}/${game.chunks.length})`);
  fs.writeFileSync(path.join(ZH_DIR, game.id + ".html"), parts.join("\n"));
  written++;
}
console.log(`写入 ${written} 个游戏中文版 -> content/bga-zh/`);
if (incomplete.length) console.log("不完整（可重跑缺失分块后再次收集）：\n  " + incomplete.join("\n  "));
