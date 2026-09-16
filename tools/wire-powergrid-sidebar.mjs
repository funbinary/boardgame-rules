// 给 18 个独立规则页的侧边栏追加 电力公司 条目(幂等:已有则跳过)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "7-wonders", "ark-nova-marine-worlds", "ascension", "barcelona",
  "brass-birmingham", "clank-catacombs", "dune-imperium",
  "dune-imperium-uprising", "food-chain-magnate", "galileo-galilei",
  "orloj", "pokemon-grove", "puerto-rico", "speakeasy", "trajan",
  "tulip-bubble", "vale-of-eternity", "wingspan",
];
const LI = `<li><a href="power-grid.html">⚡ 电力公司</a></li>`;
const re = /(<li><a href="speakeasy\.html">[^<]*<\/a><\/li>)(\s*\n)(?!\s*<li><a href="power-grid\.html")/;

for (const p of pages) {
  const f = path.join(ROOT, "games", p + ".html");
  let html = fs.readFileSync(f, "utf8");
  if (html.includes(`<li><a href="power-grid.html">`)) { console.log(`${p}: 已有,跳过`); continue; }
  if (!re.test(html)) { console.log(`${p}: 未找到地下酒吧侧边栏行!`); continue; }
  html = html.replace(re, `$1\n          ${LI}$2`);
  fs.writeFileSync(f, html);
  console.log(`${p}: 已追加`);
}
