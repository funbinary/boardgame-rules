// 一次性清理 games/seti.html 中装配器漏剥的片头题头段落 <p># 规则书第 N 页（扫描图 NN)</p>
// (assemble-seti.mjs 已同步修复,本脚本处理存量页面)
import fs from "node:fs";
const f = "games/seti.html";
let html = fs.readFileSync(f, "utf8");
const before = (html.match(/<p># 规则书第 \d+ 页[^<]*<\/p>\n*/g) || []).length;
html = html.replace(/<p># 规则书第 \d+ 页[^<]*<\/p>\n*/g, "");
// 顺带清理因此产生的连续空行
html = html.replace(/\n{3,}/g, "\n\n");
fs.writeFileSync(f, html);
console.log(`removed ${before} stray headings`);
