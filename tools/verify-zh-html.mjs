// 权威校验 content/bga-zh/*.html 的标签平衡（解析器级计数，与 repair 同一套标签正则）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "bga-zh");
const files = fs.readdirSync(DIR).filter(f => f.endsWith(".html"));
let bad = 0;
const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
for (const f of files) {
  const t = fs.readFileSync(path.join(DIR, f), "utf8");
  const counts = new Map();
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(t))) {
    const name = m[1].toLowerCase();
    const isClose = m[0][1] === "/";
    const c = counts.get(name) || [0, 0];
    if (isClose) c[1]++; else if (!m[0].endsWith("/>")) c[0]++;
    counts.set(name, c);
  }
  for (const [tag, [o, c]] of counts) {
    if (o !== c) { console.log("UNBALANCED", f, tag, o, c); bad++; }
  }
}
console.log("files:", files.length, "| unbalanced tag types:", bad);
