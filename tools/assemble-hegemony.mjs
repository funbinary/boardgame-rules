// 把 content/_transcripts/hegemony/ 下的 36 页转录片段装配为 content/bga-zh/hegemony.html
// 用法: node tools/assemble-hegemony.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "hegemony");
const OUT = path.join(ROOT, "content", "bga-zh", "hegemony.html");
const IMG = "../../assets/img/bga/hegemony";

// 每页插图题注(未列出的用默认题注)
const CAPTIONS = {
  1: "《领国者》游戏盒封面 · HEGEMONY—帶領你的人民邁向勝利",
  2: "规则书第 2 页 · 游戏配件:图板、玩家帮助与 270 张普通卡牌",
  3: "规则书第 3 页 · 符号:55 张小型卡牌、222 个指示物与 231 个木制配件",
  4: "规则书第 4 页 · 游戏配件解析:企业卡与行动卡",
  5: "规则书第 5 页 · 出口卡、政治理念卡、移民卡、事件卡、商务合约卡与仓库",
  6: "规则书第 6 页 · 游戏图板",
  7: "规则书第 7 页 · 玩家图板(劳动/中产/资本阶级与国家)",
  8: "规则书第 8 页 · 主游戏图板设置",
  9: "规则书第 9 页 · 游戏设置总览(图示)",
  10: "规则书第 10 页 · 玩家设置(四大阶级)",
};

// 跨页拼接:前一页末段与后一页首段同属一句/同一段
const JOINS = [
  { pages: [15, 16], type: "text" }, // "……罢工指" + "示物,但不能……"
  { pages: [22, 23], type: "text" }, // "……出现空缺," + "而必须将该企业其余的劳工……"
  { pages: [30, 31], type: "text" }, // "……这项政" + "策不只增加……"
];

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

function readFrag(n) {
  const raw = fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
  return raw;
}

function normalizePunct(t) {
  // 半角逗号/冒号(紧邻中文)统一为全角
  t = t.replace(new RegExp(`([${CJK}）】」”]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【「“])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”]):`, "g"), "$1：");
  return t;
}

function preprocess(n, text) {
  let t = text;
  // 去掉文件头注释与 H1 页眉行
  t = t.replace(/^<!--[\s\S]*?-->\s*/m, "");
  t = t.replace(/^# .*$/gm, "");
  // 去掉跨页编辑注
  t = t.replace(/\*?\(本页到此中断[^)]*\)\*/g, "");
  t = t.replace(/\*?\(承第\s*\d+\s*页[^)]*\)\*/g, "");
  t = t.replace(/\*?\(接第\s*\d+\s*页[^)]*\)\*/g, "");
  t = t.replace(/〔文接下页〕/g, "");
  // 货币符号统一(原书花体符号,扫描转录中出现过多种近似写法)
  t = t.replace(/[₴₩$¥￥]/g, "𝓥");
  // 同一资源图标统一(麦穗=食物)
  t = t.replace(/♪/g, "🌾");
  // 页内径改(记录于页首整理说明)
  if (n === 15) {
    t = t.replace(/当玩家派遣罢工时/, "当玩家派遣劳工时");
    t = t.replace(/平放躺在栏位上/, "平放置在栏位上");
  }
  if (n === 18) {
    t = t.replace(/\*麦克\*+𝓥遣/g, "**麦克**派遣");
  }
  return normalizePunct(t);
}

// 拼接跨页断句:把后页首个内容行并入前页最后一个内容行
function applyJoins(frags) {
  for (const join of JOINS) {
    const [a, b] = join.pages;
    const fa = frags[a].trimEnd().split("\n");
    const fb = frags[b].split("\n");
    // 前页最后一个非空行
    let ia = fa.length - 1;
    while (ia >= 0 && !fa[ia].trim()) ia--;
    // 后页第一个非空行
    let ib = 0;
    while (ib < fb.length && !fb[ib].trim()) ib++;
    const tail = fa[ia].replace(/……\s*$/, "");
    let head = fb[ib].replace(/^\(接上页\)/, "").replace(/^……/, "");
    // 同为引用块则保留前缀
    if (tail.trimStart().startsWith(">") && head.trimStart().startsWith(">")) {
      fa[ia] = tail.replace(/\s*$/, "") + head.replace(/^\s*>\s?/, "");
    } else if (!tail.trimStart().startsWith(">") && !head.trimStart().startsWith(">")) {
      fa[ia] = tail.replace(/\s*$/, "") + head;
    } else {
      continue; // 类型不匹配,不拼
    }
    frags[a] = fa.join("\n");
    fb.splice(ib, 1);
    frags[b] = fb.join("\n");
  }
  return frags;
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return out;
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^#{2,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ""))}</h${level}>`);
      i++; continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      let html = "<table>\n<thead>\n<tr>" + cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n<tbody>\n";
      for (const r of rows.slice(1)) {
        if (/^[\s|:-]+$/.test(r)) continue;
        html += "<tr>" + cells(r).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>\n";
      }
      out.push(html + "</tbody>\n</table>");
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push("<blockquote>\n" + mdToHtml(quote.join("\n")) + "\n</blockquote>");
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      out.push("<ul>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "\n</ul>");
      continue;
    }
    // 普通段落(单行)
    let text = line.trim();
    if (/^\\\*/.test(text)) text = "＊" + text.slice(2);
    out.push(`<p>${inline(text)}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n  <img src="${IMG}/${nn}.jpg" alt="领国者规则书第 ${n} 页扫描图" loading="lazy">\n  <figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 36; n++) frags[n] = preprocess(n, readFrag(n));
applyJoins(frags);
// 拼接点两侧的半角标点再统一一遍
for (let n = 1; n <= 36; n++) frags[n] = normalizePunct(frags[n]);

const parts = [figure(1)];
parts.push(`<blockquote>
  <p>本页整理自哔哩哔哩「客厅猫桌游研究会」发布的《领国者规则书》<a href="https://www.bilibili.com/opus/1244101530062159880" target="_blank" rel="noopener">上篇</a>与<a href="https://www.bilibili.com/opus/1244102552250744886" target="_blank" rel="noopener">下篇</a>所载官方中文规则书扫描图(Hegemony: Lead Your Class to Victory,Vangelis Bagiartakis、Varnavas Timotheou 设计,Hegemonic Project Games 出版),共 36 页逐页转录,并在对应章节嵌入原书扫描页供对照——<strong>点击任意扫描页即可放大查看</strong>。内容涵盖游戏配件与符号、游戏图板与玩家图板、设置、回合流程(准备/行动/生产/表决/得分阶段)、四大阶级各自的基础行动与自由行动、政策表、其他规则(IMF 干预等)与规则释疑。规则内容归版权方所有,转录仅供个人学习查阅。</p>
  <p><small>整理说明:扫描页经逐页放大转录、数字逐位核对与跨页衔接校验,个别印刷过小的卡面文字无法辨认处以〔?〕标示。原书花体货币符号在各页印法不一,全书统一转写作 𝓥;表内"✓/×/·"为原书符号。原书排印错误均按原文照录(如第 3 页"231 个木制配件"各项之和实为 241、第 12 页"的的/为为"、第 16 页"每间每间"、第 34 页"价格。。"等);以下数处径改并在此说明——第 15 页"当玩家派遣罢工时"改为"派遣劳工"(与第 23 页同句一致),"平放躺在栏位上"按同句字形定为"平放置在栏位上";第 18 页范例"麦克𝓥遣"中的花体符号系原书排印之误,径改为"派遣"。第 15/23 页卡面照片中的小字价格(16𝓥、25𝓥/30𝓥/15𝓥)为图示内容,仅作参考。</small></p>
</blockquote>`);

for (let n = 1; n <= 36; n++) {
  if (n > 1) parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

fs.writeFileSync(OUT, parts.join("\n\n") + "\n");
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
