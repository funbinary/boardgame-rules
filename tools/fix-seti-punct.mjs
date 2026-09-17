// 统一 SETI 转录稿正文标点为全角(与原书一致)。
// 保护〔…〕转录标注内部与「」引号内引用的原样瑕疵,只动正文。
// 用法: node tools/fix-seti-punct.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "seti");
const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef）」”〕】…—〕";
const L = new RegExp(`([${CJK}])`, "g");

function protect(t) {
  const spans = [];
  t = t.replace(/〔[^〕]*〕/g, (m) => { spans.push(m); return `\u0000${spans.length - 1}\u0000`; });
  return { t, spans };
}
function restore(t, spans) {
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[Number(i)]);
}

function fixLine(line) {
  let s = line;
  // 逗号 / 冒号 / 分号
  s = s.replace(new RegExp(`([${CJK}]),`, "g"), "$1，");
  s = s.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  s = s.replace(new RegExp(`([${CJK}]):(?!//)`, "g"), "$1：");
  s = s.replace(new RegExp(`:([${CJK}（【“「〔])`, "g"), "：$1");
  s = s.replace(new RegExp(`([${CJK}]);`, "g"), "$1；");
  // 括号
  s = s.replace(new RegExp(`([${CJK}）」”〕。，；：？!！])\\(`, "g"), "$1（");
  s = s.replace(new RegExp(`\\)([${CJK}（【“「〔。，；：、？!！])`, "g"), "）$1");
  s = s.replace(new RegExp(`\\(([${CJK}（【“「〔])`, "g"), "（$1");
  s = s.replace(new RegExp(`([${CJK}）」”〕%。、；：，])\\)`, "g"), "$1）");
  // 问号 / 叹号
  s = s.replace(new RegExp(`([${CJK}）」”〕])\\?`, "g"), "$1？");
  s = s.replace(new RegExp(`([${CJK}）」”〕])!(?!!)`, "g"), "$1！");
  s = s.replace(new RegExp(`!([${CJK}。？；，])`, "g"), "！$1");
  // 引号:同一行内成对的直引号且内容含中文 → 弯引号
  s = s.replace(/"([^"\n]*[\u4e00-\u9fff][^"\n]*)"/g, "“$1”");
  return s;
}

const files = fs.readdirSync(SRC).filter(f => /^p\d+\.md$/.test(f)).sort();
let changed = 0;
for (const f of files) {
  const p = path.join(SRC, f);
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split("\n").map((line) => {
    // 先保护〔…〕标注,仅对标注外正文做全角化
    const { t, spans } = protect(line);
    return restore(fixLine(t), spans);
  });
  const out = lines.join("\n");
  if (out !== raw) { fs.writeFileSync(p, out); changed++; console.log(`${f}: fixed`); }
}
console.log(`done, ${changed}/${files.length} files changed`);
