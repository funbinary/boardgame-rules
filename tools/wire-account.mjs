// 给全部游戏页注入用户收藏能力（幂等，可重复执行）：
//   1. <body …> 追加 data-game-key="<slug>"（精选页 slug 或 bga/<id>）
//   2. main.js 引用后追加 account.js 引用
// 精选页与 BGA 页的模板源头分别在各自 assemble-*.mjs / build-bga.mjs，
// 本脚本负责存量页面的批量收编；BGA 模板已同步更新。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function listHtml(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(dir, f));
}

const files = [
  ...listHtml(join(root, "games")),
  ...listHtml(join(root, "games", "bga")),
];

let patchedBody = 0;
let patchedScript = 0;
const problems = [];

for (const file of files) {
  const rel = file.slice(root.length).replace(/\\/g, "/");
  // games/seti.html → seti；games/bga/catan.html → bga/catan
  const key = rel.replace(/^games\//, "").replace(/\.html$/, "");
  const depth = rel.split("/").length - 1; // 精选 1 层、BGA 2 层
  const relAssets = "../".repeat(depth) + "assets/js/account.js";

  let html = readFileSync(file, "utf8");
  const before = html;

  // 1) body 注入 data-game-key
  if (!/data-game-key=/.test(html)) {
    if (!/<body[^>]*>/.test(html)) {
      problems.push(`${rel}: 找不到 <body> 标签`);
      continue;
    }
    html = html.replace(/<body([^>]*)>/, (m, attrs) => `<body${attrs} data-game-key="${key}">`);
    patchedBody++;
  } else if (!html.includes(`data-game-key="${key}"`)) {
    problems.push(`${rel}: data-game-key 与文件名不一致`);
  }

  // 2) main.js 后追加 account.js
  if (!html.includes("assets/js/account.js")) {
    const mainTag = new RegExp(`<script src="${"\\.\\./".repeat(depth)}assets/js/main\\.js"></script>`);
    if (!mainTag.test(html)) {
      problems.push(`${rel}: 找不到 main.js 引用`);
      continue;
    }
    html = html.replace(mainTag, (m) => `${m}\n  <script src="${relAssets}"></script>`);
    patchedScript++;
  }

  if (html !== before) writeFileSync(file, html);
}

console.log(`扫描 ${files.length} 个游戏页`);
console.log(`注入 data-game-key: ${patchedBody} 个`);
console.log(`注入 account.js 引用: ${patchedScript} 个`);
if (problems.length) {
  console.error("异常：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("完成");
