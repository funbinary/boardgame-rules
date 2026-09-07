// 把 games/bga/ 全部规则页翻译成中文（需要智谱 API Key）
//
// 用法:
//   set ZHIPUAI_API_KEY=你的key
//   node tools/translate-bga.mjs            # 全量翻译（可随时 Ctrl+C，重跑自动续传）
//   node tools/translate-bga.mjs hearts azul catan   # 只翻译指定游戏
//
// 机制:
//   1. 从 _bga/raw/ 重建英文正文（与 build-bga.mjs 同一套清理逻辑的简化版）
//   2. 按 HTML 块边界分块（约 3000 字符），调用 GLM 翻译，标签结构原样保留
//   3. 结果写入 content/bga-zh/<id>.html，然后自动重跑 build-bga.mjs 生成页面
//   4. 断点续传：已存在的 override 跳过；分块级缓存 _bga/translate-cache.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { repairHtmlAuto } from "./repair-zh-html.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "_bga", "raw");
const ZH_DIR = path.join(ROOT, "content", "bga-zh");
const CACHE_FILE = path.join(ROOT, "_bga", "translate-cache.json");
fs.mkdirSync(ZH_DIR, { recursive: true });

const KEY = process.env.ZHIPUAI_API_KEY || process.env.Z_AI_API_KEY;
if (!KEY) { console.error("缺少环境变量 ZHIPUAI_API_KEY（或 Z_AI_API_KEY）"); process.exit(1); }
const MODEL = process.env.GLM_MODEL || (process.env.ZHIPUAI_API_KEY ? "glm-4-flash" : "glm-4.5-air");
const API = (process.env.ZAI_BUSINESS_BASE_URL || "https://open.bigmodel.cn") + "/api/paas/v4/chat/completions";
const CONCURRENCY = parseInt(process.env.TRANSLATE_CONCURRENCY || "4", 10);

const SYS = `你是桌游规则翻译引擎。把用户给的 HTML 片段从英文翻译成简体中文。
要求：
1. 保留所有 HTML 标签、属性和结构，逐字不增不减，只翻译标签之间的文本；
2. 桌游术语统一：deck=牌库，hand=手牌，discard=弃牌，draw=摸牌，turn=回合，round=轮，tile=板块，token=标记，meeple=米宝，pawn=棋子，dice=骰子，score=分数，vp=分数，trick=墩，bid=竞叫，trading=交易；
3. 游戏名、设计师名、地名等专有名词保留英文；
4. 只输出翻译后的 HTML，不要任何解释、不要代码块标记。`;

/* ---------- 重建英文正文（与 build 同源的最小逻辑） ---------- */
const stripTags = (s) => s;
const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith(".json"));
const byTitle = new Map();
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"));
    const t = d.parse?.title;
    if (t && d.parse?.text?.["*"] && !byTitle.has(t)) byTitle.set(t, d.parse.text["*"]);
  } catch {}
}
const jobs = [];
for (const [title, html] of byTitle) {
  const id = title.replace(/^Gamehelp/i, "");
  let h = html
    .replace(/<div[^>]*id="toc"[\s\S]*?<\/nav>|<div[^>]*id="toc"[\s\S]*?<!--[\s\S]*?-->\s*<\/div>/g, "")
    .replace(/<span class="mw-editsection"[\s\S]*?<\/span>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  jobs.push({ id, html: h });
}
console.log(`共 ${jobs.length} 个游戏待处理`);

/* ---------- 分块：按块级标签切，单块 ≤ ~3000 字符 ---------- */
function chunkHtml(html) {
  const parts = html.split(/(?=<(?:h1|h2|h3|h4|p|ul|ol|table|dl|blockquote|figure|div)\b)/i).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if (cur.length + p.length > 3000 && cur) { chunks.push(cur); cur = ""; }
    if (p.length > 3000) {
      // 单块过大（多为大表格）：按行切
      let sub = "";
      for (const row of p.split(/(?=<tr\b)/i)) {
        if (sub.length + row.length > 3000 && sub) { chunks.push(sub); sub = ""; }
        sub += row;
      }
      cur = sub;
    } else cur += p;
  }
  if (cur) chunks.push(cur);
  // 二次切：任何超 3000 的块，按闭合标签边界拆分（大 <ul>/<div> 等表格以外的块）
  const out = [];
  for (const c of chunks) {
    if (c.length <= 3000) { out.push(c); continue; }
    let rest = c;
    while (rest.length > 3000) {
      let cut = rest.lastIndexOf("</li>", 3000);
      if (cut < 500) cut = rest.lastIndexOf(">", 3000);
      if (cut < 500) cut = rest.lastIndexOf(" ", 3000);
      if (cut < 500) cut = 3000;
      out.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    out.push(rest);
  }
  return out;
}

/* ---------- GLM 调用 ---------- */
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
let cacheDirty = 0;
async function translateChunk(chunk) {
  const key = crypto.createHash("md5").update(chunk).digest("hex");
  if (cache[key]) return cache[key];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [ { role: "system", content: SYS }, { role: "user", content: chunk } ],
          temperature: 0.1,
          // glm-4.5 系列默认开启思考，翻译任务关掉以提速
          ...(MODEL.startsWith("glm-4.5") || MODEL.startsWith("glm-4.6") ? { thinking: { type: "disabled" } } : {}),
        }),
          signal: AbortSignal.timeout(parseInt(process.env.TRANSLATE_TIMEOUT || "180000", 10)),
      });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 120));
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content?.trim()
        .replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "");
      if (!text) throw new Error("空响应");
      cache[key] = text;
      cacheDirty++;
      if (cacheDirty % 20 === 0) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return text;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

/* ---------- 主流程 ---------- */
const only = process.argv.slice(2);
let done = 0, skipped = 0, failed = 0;
const list = only.length ? jobs.filter(j => only.includes(j.id)) : jobs;

async function worker() {
  while (list.length) {
    const job = list.shift();
    if (!job) break;
    const outFile = path.join(ZH_DIR, job.id + ".html");
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 50) { skipped++; continue; }
    try {
      const chunks = chunkHtml(job.html);
      const out = [];
      for (const c of chunks) out.push(await translateChunk(c));
      fs.writeFileSync(outFile, repairHtmlAuto(out.join("\n")));
      done++;
      if (done % 10 === 0) {
        const msg = `进度 ${done + skipped}/${list.length + done + skipped} 完成，失败 ${failed}`;
        console.log(msg);
      }
    } catch (e) {
      failed++;
      console.log(`失败 ${job.id}: ${e.message.slice(0, 100)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
console.log(`翻译完成：本次 ${done}，已存在 ${skipped}，失败 ${failed}。开始重建页面…`);
try { execSync("node tools/build-bga.mjs", { cwd: ROOT, stdio: "inherit" }); } catch {}
