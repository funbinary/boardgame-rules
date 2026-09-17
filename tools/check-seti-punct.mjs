// 校验:排除〔…〕标注行与待剥离小节后,正文不应再有紧跟中文的半角标点
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "seti");
const bad = /[\u4e00-\u9fff][,:;()?!]/;
let n = 0;
for (const f of fs.readdirSync(SRC).filter(f => /^p\d+\.md$/.test(f)).sort()) {
  let skip = false;
  fs.readFileSync(path.join(SRC, f), "utf8").split("\n").forEach((line, i) => {
    if (/^#{2,4} (疑似排印问题|组件数量加和自检|其他说明)/.test(line)) skip = true;
    else if (/^#{1,4} /.test(line)) skip = false;
    if (!skip && !line.includes("〔") && bad.test(line)) {
      console.log(`${f}:${i + 1}: ${line}`);
      n++;
    }
  });
}
console.log(n === 0 ? "CLEAN" : `${n} residual lines`);
