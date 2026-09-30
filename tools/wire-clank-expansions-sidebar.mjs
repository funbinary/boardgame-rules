// 全站侧边栏统一为 canonical 列表(29 个条目,去掉本页自身),并给基础游戏页补扩展互链
// 用法: node tools/wire-clank-expansions-sidebar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SIDEBAR = [
  ["7-wonders.html", "🏛️ 七大奇迹"],
  ["brass-birmingham.html", "🏭 工业革命：伯明翰"],
  ["vale-of-eternity.html", "✨ 永恒之谷"],
  ["wingspan.html", "🦜 展翅翱翔"],
  ["pokemon-grove.html", "🌳 宝可梦林地探索"],
  ["puerto-rico.html", "⛵ 波多黎各"],
  ["barcelona.html", "🌸 巴塞罗那"],
  ["dune-imperium.html", "🏜️ 沙丘：帝国"],
  ["dune-imperium-uprising.html", "🪱 沙丘：帝国起义"],
  ["ascension.html", "🃏 创升纪元"],
  ["tulip-bubble.html", "🌷 郁金香泡沫"],
  ["trajan.html", "🦅 图拉真"],
  ["galileo-galilei.html", "🔭 伽利略：伽利莱"],
  ["orloj.html", "🕰️ 奥洛伊：布拉格天文钟"],
  ["food-chain-magnate.html", "🍔 快餐连锁大亨"],
  ["clank-catacombs.html", "🐉 CLANK! 地下墓穴"],
  ["clank-catacombs-underworld.html", "💀 CLANK! 地下墓穴:地下世界"],
  ["clank-adventuring-party.html", "🗡️ CLANK! 冒险队"],
  ["ark-nova-marine-worlds.html", "🐙 方舟动物园：海洋世界"],
  ["arnak-expedition-leaders.html", "🗿 阿纳克遗迹:探险队长"],
  ["speakeasy.html", "🎷 地下酒吧"],
  ["power-grid.html", "⚡ 电力公司"],
  ["seti.html", "🛰️ SETI：寻找外星人"],
  ["endeavor-deep-sea.html", "🌊 奋进号：深海"],
  ["druids-of-edora.html", "🌲 埃多拉的德鲁伊"],
  ["grand-austria-hotel.html", "🏨 奥地利大饭店"],
  ["the-message.html", "🕵️ 风声再临"],
  ["gwt-new-zealand.html", "🐑 大西部开拓者:新西兰"],
  ["fields-of-arle.html", "🌾 阿勒農場"],
];

const files = fs
  .readdirSync(path.join(ROOT, "games"))
  .filter((f) => f.endsWith(".html"));

const navRe = /(<nav aria-label="全部游戏">[\s\S]*?<ul>\n)([\s\S]*?)(\n *<\/ul>)/;
let changed = 0;
for (const f of files) {
  const p = path.join(ROOT, "games", f);
  let html = fs.readFileSync(p, "utf8");
  const items = SIDEBAR.filter(([href]) => href !== f)
    .map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`)
    .join("\n");
  const next = html.replace(navRe, `$1          <li><a href="../index.html">🏠 返回首页</a></li>\n${items}$3`);
  if (next !== html) {
    fs.writeFileSync(p, next);
    changed++;
    console.log(`${f}: sidebar updated`);
  } else if (!navRe.test(html)) {
    console.log(`${f}: 全部游戏 nav 未匹配!`);
  }
}

// 基础游戏页补扩展互链(幂等)
const base = path.join(ROOT, "games", "clank-catacombs.html");
let baseHtml = fs.readFileSync(base, "utf8");
if (!baseHtml.includes("扩展规则:本站另收录")) {
  baseHtml = baseHtml.replace(
    /(<p><small>整理说明：[^<]*扫描集共 17 图)/,
    `扩展规则:本站另收录《CLANK! 地下墓穴:地下世界》扩展与《CLANK! 冒险队》(5–6 人)扩展的规则书全文转录页,见<a href="clank-catacombs-underworld.html">地下世界</a>与<a href="clank-adventuring-party.html">冒险队</a>。</small></p>\n<p><small>$1`,
  );
  fs.writeFileSync(base, baseHtml);
  console.log("clank-catacombs.html: 扩展互链已加");
} else {
  console.log("clank-catacombs.html: 互链已存在,跳过");
}
console.log(`done, ${changed}/${files.length} pages updated`);
