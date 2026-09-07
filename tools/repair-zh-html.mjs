// 修复翻译产物的 HTML：
//   1) 转义正文里模型残留的裸 `<`（以英文原页面的标签集为白名单，防止伪标签吞字）
//   2) 补齐缺失的闭合标签、丢弃多余的闭合标签（栈式配对）
// 用法：node tools/repair-zh-html.mjs [文件...]  （无参数则修复 content/bga-zh/ 全部）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZH_DIR = path.join(ROOT, "content", "bga-zh");
const RAW_DIR = path.join(ROOT, "_bga", "raw");

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"]);

// 从英文原始页面收集合法标签名（全部小写）
function collectLegitTags() {
  const set = new Set(["!doctype"]);
  try {
    for (const f of fs.readdirSync(RAW_DIR)) {
      if (!f.endsWith(".json")) continue;
      const html = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"))?.parse?.text?.["*"] || "";
      for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)) set.add(m[1].toLowerCase());
    }
  } catch {}
  return set;
}

// 转义正文里不构成合法标签起点的 `<`：
//   alt1: 形如 <name / </name 且名字后有边界（空白/属性/结束）→ 名字在白名单才保留
//   alt2: < 后面不是字母/!/（ → 一定是正文文本，转义
//   alt3: 标签名后没有边界（如 <p如果 → 浏览器会把中文并进标签名）→ 转义
const escapeBareLt = (html, legit) =>
  html.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])|<(?![a-zA-Z!/])|<(?:\/?)([a-zA-Z][a-zA-Z0-9]*)/g,
    (full, slash, name) => {
      if (name !== undefined && legit.has(name.toLowerCase())) return full;
      return full.replace("<", "&lt;");
    }
  );

export function repairHtml(html, legit) {
  if (legit) html = escapeBareLt(html, legit);
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let out = "", last = 0, m;
  const stack = [];
  while ((m = re.exec(html))) {
    out += html.slice(last, m.index);
    last = re.lastIndex;
    const full = m[0];
    const t = m[1].toLowerCase();
    if (full[1] === "/") {
      const idx = stack.lastIndexOf(t);
      if (idx < 0) continue; // 多余的闭合标签：丢弃（浏览器同样忽略）
      // 补齐中间未闭合的标签，并输出自身对应的闭合标签（原标签不再重复输出）
      for (let i = stack.length - 1; i >= idx; i--) out += "</" + stack[i] + ">";
      stack.length = idx;
    } else {
      if (!full.endsWith("/>") && !VOID.has(t)) stack.push(t);
      out += full;
    }
  }
  out += html.slice(last);
  for (let i = stack.length - 1; i >= 0; i--) out += "</" + stack[i] + ">";
  return out;
}

let _legit;
export function repairHtmlAuto(html) {
  _legit = _legit || collectLegitTags();
  return repairHtml(html, _legit);
}

const only = process.argv.slice(2);
const files = only.length ? only.map(f => path.basename(f)) : fs.readdirSync(ZH_DIR).filter(f => f.endsWith(".html"));
const legit = collectLegitTags();
console.log("合法标签集:", [...legit].sort().join(" "));
let changed = 0;
for (const f of files) {
  const p = path.join(ZH_DIR, f);
  const before = fs.readFileSync(p, "utf8");
  const after = repairHtml(before, legit);
  if (after !== before) { fs.writeFileSync(p, after); changed++; }
}
console.log(`修复 ${changed}/${files.length} 个文件`);
