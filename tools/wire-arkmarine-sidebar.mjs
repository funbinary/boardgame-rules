// 给 16 个独立规则页的侧边栏追加 方舟动物园：海洋世界 条目(幂等:已有则跳过)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "7-wonders", "ascension", "barcelona", "brass-birmingham",
  "clank-catacombs", "dune-imperium", "dune-imperium-uprising",
  "food-chain-magnate", "galileo-galilei", "orloj", "pokemon-grove",
  "puerto-rico", "trajan", "tulip-bubble", "vale-of-eternity", "wingspan",
];
const LI = `<li><a href="ark-nova-marine-worlds.html">🐙 方舟动物园：海洋世界</a></li>`;
const re = /(<li><a href="clank-catacombs\.html">[^<]*<\/a><\/li>)(\s*\n)(?!\s*<li><a href="ark-nova-marine-worlds\.html")/;

for (const p of pages) {
  const f = path.join(ROOT, "games", p + ".html");
  let html = fs.readFileSync(f, "utf8");
  if (html.includes(`<li><a href="ark-nova-marine-worlds.html">`)) { console.log(`${p}: 已有,跳过`); continue; }
  if (!re.test(html)) { console.log(`${p}: 未找到CLANK侧边栏行!`); continue; }
  html = html.replace(re, `$1\n          ${LI}$2`);
  fs.writeFileSync(f, html);
  console.log(`${p}: 已追加`);
}
