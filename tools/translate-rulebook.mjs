// 规则书批量翻译：_bgg/rulebooks/<slug>/en.md -> zh.md（GLM，与 translate-bga.mjs 同一套 API/缓存风格）
// 用法: node tools/translate-rulebook.mjs <slug> [slug2 ...] [--dry]
//   --dry 只统计分块数不调用 API
// 要求 en.md 已由 extract-pdf.py 生成；zh.md 已存在则跳过（--force 重译）
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RB = path.join(ROOT, "_bgg", "rulebooks");
const CACHE_FILE = path.join(ROOT, "_bga", "translate-cache-rulebook.json");

const KEY = process.env.Z_AI_API_KEY || process.env.ZHIPUAI_API_KEY;
if (!KEY) { console.error("缺少环境变量 Z_AI_API_KEY"); process.exit(1); }
const MODEL = process.env.GLM_MODEL || "glm-4.5-air";
const API = (process.env.ZAI_BUSINESS_BASE_URL || "https://open.bigmodel.cn") + "/api/paas/v4/chat/completions";
const CONCURRENCY = parseInt(process.env.TRANSLATE_CONCURRENCY || "4", 10);
const CHUNK = parseInt(process.env.RB_CHUNK || "2800", 10);

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const dry = argv.includes("--dry");
const slugs = argv.filter(a => !a.startsWith("--"));

const SYS = `你是资深桌游规则书翻译引擎，把英文桌游规则书全文翻译成简体中文 markdown。
要求：
1. 忠实逐句翻译，禁止按你对桌游规则的了解增删、改写或"修正"规则；数字、费用、数量、顺序必须与原文完全一致；
2. 结构处理：<!--page:N--> 分页标记原样保留、独占一行；原文以 ## / ### 开头的行是章节标题，译文保留同样的 # 前缀（标题本身要翻译）；原文明显的章节标题（即使没有 # 前缀）也译为 markdown 标题（大节 ##、小节 ###、更小 ####）；列表保持 - 列表；示例/引用块用 > 引用；普通段落空行分隔；
2b. 段落合并：原文因版面宽度被拆成多行的句子/段落，译文要合并成完整通顺的段落输出，不要逐视觉行断行；
3. 术语统一：deck=牌库，hand=手牌，discard pile=弃牌堆，draw=摸牌，turn=回合，round=轮，tile=板块，token=指示物，meeple=米宝，pawn=棋子，die/dice=骰子，score/point=分数，VP=胜利点，trick=墩，bid=竞标，worker placement=工人放置，action=行动，setup=设置，end of game=游戏结束，solo=单人模式，expansion=扩展，card=卡牌，board=版图，space=格/区域（按语境），space(宇宙)=太空，player=玩家，opponent=对手；
4. 游戏名、设计师名、出版社名保留英文原文（可括注中文）；地图/板块上的专名首现时括注英文；
5. 原文因排版产生的断词、错位换行要合并为通顺句子；页面装饰性文字（如纯装饰口号）可略；
6. 只输出译文，不要任何解释、不要代码块标记。`;

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
let cacheDirty = 0;
async function translateChunk(chunk) {
  const key = crypto.createHash("md5").update(chunk).digest("hex");
  if (cache[key]) return cache[key];
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: SYS }, { role: "user", content: chunk }],
          temperature: 0.1,
          ...(MODEL.startsWith("glm-4.5") || MODEL.startsWith("glm-4.6") ? { thinking: { type: "disabled" } } : {}),
        }),
        signal: AbortSignal.timeout(parseInt(process.env.TRANSLATE_TIMEOUT || "240000", 10)),
      });
      if (!res.ok) {
        if (res.status === 400 && chunk.length > 900) {
          // 内容过滤 400：对半分块分别译（战争题材规则书会撞）
          const mid = Math.floor(chunk.length / 2);
          let cut = chunk.lastIndexOf("\n\n", mid);
          if (cut < 200) cut = mid;
          const a = await translateChunk(chunk.slice(0, cut));
          const b = await translateChunk(chunk.slice(cut));
          return a + "\n\n" + b;
        }
        throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 120));
      }
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content?.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "");
      if (!text) throw new Error("空响应");
      cache[key] = text;
      cacheDirty++;
      if (cacheDirty % 20 === 0) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return text;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// 分块：优先在 <!--page:N--> 边界切，再按段落边界
function chunkMd(md) {
  const units = md.split(/(?=<!--page:\d+-->)/);
  const chunks = [];
  let cur = "";
  const push = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ""; };
  for (const u of units) {
    if (u.length <= CHUNK && cur.length + u.length > CHUNK) push();
    if (u.length > CHUNK) {
      push();
      // 页内再按段落切
      let sub = "";
      for (const para of u.split(/\n\s*\n/)) {
        if (sub.length + para.length > CHUNK && sub) { chunks.push(sub.trim()); sub = ""; }
        if (para.length > CHUNK) {
          // 超长段落按行切
          let line = "";
          for (const l of para.split("\n")) {
            if (line.length + l.length > CHUNK && line) { chunks.push(line.trim()); line = ""; }
            line += l + "\n";
          }
          sub = line;
        } else sub += para + "\n\n";
      }
      if (sub.trim()) chunks.push(sub.trim());
      continue;
    }
    cur += u + "\n\n";
  }
  push();
  return chunks;
}

let done = 0, failed = 0;
let chunkDone = 0;
async function worker(queue) {
  while (queue.length) {
    const slug = queue.shift();
    if (!slug) break;
    const dir = path.join(RB, slug);
    const en = fs.readFileSync(path.join(dir, "en.md"), "utf8");
    const chunks = chunkMd(en);
    const outFile = path.join(dir, "zh.md");
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100 && !force) { console.log(`跳过 ${slug}（zh.md 已存在）`); continue; }
    if (dry) { console.log(`${slug}: ${chunks.length} 块 / ${en.length} 字符`); continue; }
    try {
      const out = [];
      let i = 0;
      for (const c of chunks) {
        out.push(await translateChunk(c));
        i++; chunkDone++;
        console.log(`  ${slug} ${i}/${chunks.length}（累计 ${chunkDone}）`);
      }
      fs.writeFileSync(outFile, out.join("\n\n"));
      done++;
      console.log(`✓ ${slug}（${chunks.length} 块 -> ${(fs.statSync(outFile).size / 1024).toFixed(0)}KB）`);
    } catch (e) {
      failed++;
      console.log(`✗ ${slug}: ${e.message.slice(0, 120)}`);
    }
  }
}

if (!slugs.length) { console.error("用法: node tools/translate-rulebook.mjs <slug>..."); process.exit(1); }
const queue = [...slugs];
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue)));
if (!dry) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
console.log(`完成 ${done} 失败 ${failed}（模型 ${MODEL}）`);
