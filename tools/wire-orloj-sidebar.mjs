// 给 13 个独立规则页的侧边栏追加奥洛伊条目(幂等:已有则跳过)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "7-wonders", "ascension", "barcelona", "brass-birmingham",
  "dune-imperium", "dune-imperium-uprising", "galileo-galilei",
  "pokemon-grove", "puerto-rico", "trajan", "tulip-bubble",
  "vale-of-eternity", "wingspan",
];
const LI = `<li><a href="orloj.html">🕰️ 奥洛伊：布拉格天文钟</a></li>`;
const re = /(<li><a href="galileo-galilei\.html">[^<]*<\/a><\/li>)(\s*\n)(?!\s*<li><a href="orloj\.html")/;

for (const p of pages) {
  const f = path.join(ROOT, "games", p + ".html");
  let html = fs.readFileSync(f, "utf8");
  if (html.includes(`<li><a href="orloj.html">`)) { console.log(`${p}: 已有,跳过`); continue; }
  if (!re.test(html)) { console.log(`${p}: 未找到伽利略侧边栏行!`); continue; }
  html = html.replace(re, `$1\n          ${LI}$2`);
  fs.writeFileSync(f, html);
  console.log(`${p}: 已追加`);
}
