// 把 content/_transcripts/tfm/ 下的 14 页转录片段装配为 content/bga-zh/terraformingmars.html
// 再由 node tools/build-bga.mjs 生成 games/bga/terraformingmars.html
// 用法: node tools/assemble-tfm.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "tfm");
const OUT = path.join(ROOT, "content", "bga-zh", "terraformingmars.html");
const IMG = "../../assets/img/bga/terraformingmars";

const CAPTIONS = {
  1: "封面横幅 · TERRAFORMING MARS 殖民火星(Jacob Fryxelius)",
  2: "P.2 开发宣言 · 背景 · 目录",
  3: "P.3 游戏总览 · 星球参数 · 改造后的火星",
  4: "P.4 游戏图板(改造度/时代轨/星球参数/标准项目/里程碑与奖励/地图)",
  5: "P.5 板块(海洋/绿化/城市/特殊) · 标记",
  6: "P.6 玩家板 · 卡牌(企业卡与项目牌示例)",
  7: "P.7 设置(含三人开局示例)",
  8: "P.8 时代:四阶段(起始玩家/研究/行动/生产)",
  9: "P.9 行动A:打出卡牌(限制条件与费用) · 示例卡A–E",
  10: "P.10 放置卡牌 · 行动B:标准项目 · 行动C:里程碑",
  11: "P.11 行动C(续) · D:资助奖励 · E:蓝色牌行动 · F:植物换绿化 · G:热能升温",
  12: "P.12 游戏结束 · 最终计分 · 建议",
  13: "P.13 游戏变体(新时代企业/单人/轮抽) · 关于设计师",
  14: "P.14 图示:胜利点 · 参数 · 资源",
  15: "P.15 图示(续):标志 · 板块 · 红色边界 · 星号",
};

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

function normalizePunct(t) {
  t = t.replace(new RegExp(`([${CJK}）】」”〕]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]):`, "g"), "$1：");
  return t;
}

function preprocess(n, text) {
  let t = text;
  t = t.replace(/^# .*$/gm, "");
  t = t.replace(/^（页脚页码[:：]\d+）\s*$/gm, "");
  t = t.replace(/^\*\(页脚页码[:：]\d+\)\*\s*$/gm, "");
  t = t.replace(/^\(接上页\)\s*/gm, "");
  // 行动 B)–G) 在转录中标为二级,统一降为行动下的三级;"### 3)放置卡牌"为 A) 下的子步骤,降为四级
  if (n >= 10 && n <= 11) {
    t = t.replace(/^## ([BCDEFG])\)/gm, "### $1)");
  }
  if (n === 10) {
    t = t.replace(/^### 3\)放置卡牌/gm, "#### 3)放置卡牌");
  }
  return normalizePunct(t);
}

// 跨页断句:P.14 末句与 P.15 首句同属一句
function applyJoin(frags) {
  const a = frags[14].trimEnd().split("\n");
  const b = frags[15].split("\n");
  let ia = a.length - 1;
  while (ia >= 0 && !a[ia].trim()) ia--;
  let ib = 0;
  while (ib < b.length && !b[ib].trim()) ib++;
  if (a[ia].includes("3M€去") && b[ib].startsWith("购买")) {
    a[ia] = a[ia].replace(/\s*$/, "") + b[ib];
    b.splice(ib, 1);
    frags[14] = a.join("\n");
    frags[15] = b.join("\n");
  }
  return frags;
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(/【图[:：]([^】]*)】/g, "<em>〔图$1〕</em>");
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
    out.push(`<p>${inline(line.trim())}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n  <img src="${IMG}/${nn}.jpg" alt="殖民火星规则书第 ${n} 页扫描图" loading="lazy">\n  <figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 2; n <= 15; n++) frags[n] = preprocess(n, fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8"));
applyJoin(frags);

const parts = [figure(1)];
parts.push(`<blockquote>
  <p>本页整理自哔哩哔哩「BGA小助手」发布的<a href="https://www.bilibili.com/opus/1030063174843367432" target="_blank" rel="noopener">《BGA桌游规则:重塑火星(Terraforming Mars)》</a>所载《殖民火星》繁体中文版规则书扫描图(Terraforming Mars,Jacob Fryxelius 设计,FryxGames 出版;转录时由繁体转为简体),封面横幅加内页 14 页逐页转录,原书扫描图随文嵌入——<strong>点击任意扫描页即可放大查看</strong>。内容涵盖游戏总览与星球参数、游戏图板、板块与标记、玩家板与卡牌六要素、设置、世代四阶段、七种行动(打出卡牌/标准项目/里程碑/奖励/蓝色牌行动/植物换绿化/热能升温)、游戏结束计分、游戏变体(新时代企业/单人/轮抽)与图示速查。规则内容归版权方所有,转录仅供个人学习查阅。</p>
  <p><small>整理说明:扫描页经逐页放大转录、数字逐位核对与跨页衔接校验;目录所载第 16 页「配件清单」不在这份扫描中,故本页不含该节。原书排印与用字均照录:第 3 页「程碑」(漏「里」)、「变的稀薄」;第 4 页编号「5:」「6:」冒号与余条句点混用;第 7 页「道轨」「非新手家」(漏「玩」)、「移除游戏」;第 8 页「会得到 M€」一句原文留白疑有缺字、「相当」疑为「相应」;第 9/10/11 页「穿梭机」折扣触发标志三处表述不一(「钛标志」/「轨道〔?〕标志」/「太空标志」),照原样保留;第 12 页例句「计画家」与第 11 页「规划者」并存、「首先先计算」;第 12–15 页「板块/版块」全书混用;第 2 页「等..」双半角点。图板/卡牌照片中过小的印刷文字无法可靠辨认处以〔无法辨认〕或〔?〕标示。</small></p>
</blockquote>`);

for (let n = 2; n <= 15; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

fs.writeFileSync(OUT, parts.join("\n\n") + "\n");
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
