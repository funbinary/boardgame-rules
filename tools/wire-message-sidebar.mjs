// 给 24 个独立规则页的侧边栏追加 风声再临 条目(幂等:已有则跳过)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "7-wonders", "ark-nova-marine-worlds", "ascension", "barcelona",
  "brass-birmingham", "clank-catacombs", "dune-imperium",
  "dune-imperium-uprising", "druids-of-edora", "endeavor-deep-sea",
  "fields-of-arle", "food-chain-magnate", "galileo-galilei",
  "grand-austria-hotel", "orloj", "pokemon-grove", "power-grid",
  "puerto-rico", "seti", "speakeasy", "trajan", "tulip-bubble",
  "vale-of-eternity", "wingspan",
];
const LI = `<li><a href="the-message.html">🕵️ 风声再临</a></li>`;
const re = /(<li><a href="grand-austria-hotel\.html">[^<]*<\/a><\/li>)(\s*\n)(?!\s*<li><a href="the-message\.html")/;

for (const p of pages) {
  const f = path.join(ROOT, "games", p + ".html");
  let html = fs.readFileSync(f, "utf8");
  if (html.includes(`<li><a href="the-message.html">`)) { console.log(`${p}: 已有,跳过`); continue; }
  if (!re.test(html)) { console.log(`${p}: 未找到大饭店侧边栏行!`); continue; }
  html = html.replace(re, `$1\n          ${LI}$2`);
  fs.writeFileSync(f, html);
  console.log(`${p}: 已追加`);
}
