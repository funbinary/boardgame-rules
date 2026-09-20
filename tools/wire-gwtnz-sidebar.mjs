// 给 25 个独立规则页的侧边栏追加 大西部开拓者:新西兰开拓史 条目(幂等:已有则跳过)
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
  "puerto-rico", "seti", "speakeasy", "the-message", "trajan",
  "tulip-bubble", "vale-of-eternity", "wingspan",
];
const LI = `<li><a href="gwt-new-zealand.html">🐑 大西部开拓者:新西兰</a></li>`;
const anchorRe = (anchor) =>
  new RegExp(`(<li><a href="${anchor}\\.html">[^<]*</a></li>)(\\s*\\n)(?!\\s*<li><a href="gwt-new-zealand\\.html")`);

for (const p of pages) {
  const f = path.join(ROOT, "games", p + ".html");
  let html = fs.readFileSync(f, "utf8");
  if (html.includes(`<li><a href="gwt-new-zealand.html">`)) { console.log(`${p}: 已有,跳过`); continue; }
  let done = false;
  for (const anchor of ["the-message", "fields-of-arle", "grand-austria-hotel"]) {
    const re = anchorRe(anchor);
    if (re.test(html)) {
      html = html.replace(re, `$1\n          ${LI}$2`);
      fs.writeFileSync(f, html);
      console.log(`${p}: 已追加(锚点 ${anchor})`);
      done = true;
      break;
    }
  }
  if (!done) console.log(`${p}: 未找到锚点行!`);
}
