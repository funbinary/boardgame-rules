// 把 content/_transcripts/ark-nova/ 下的 20 页转录片段装配为 content/bga-zh/arknova.html(BGA 页源片段,gwt 风格)
// 用法: node tools/assemble-arknova.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "ark-nova");
const OUT = path.join(ROOT, "content", "bga-zh", "arknova.html");
const IMG = "../../assets/img/bga/arknova";

// 每页插图题注
const CAPTIONS = {
  1: "规则书封面 · 方舟动物园 Ark Nova（Mathias Wigge · 游人码头简体中文版）",
  2: "P.2 游戏配件：卡牌 / 板图 / 板块与标记",
  3: "P.3 其它板块与标记 · 木质配件 · 目录 · 游戏介绍与目标",
  4: "P.4 游戏设置：全局设置(1–4) · 个人设置(A–B)",
  5: "P.5 游戏设置(续)：步骤 5–7 · 个人设置 C–G · 2 人局设置图例",
  6: "P.6 游戏玩法 · 你的动物园地图",
  7: "P.7 动物园卡牌 · 休息记录条 · 合作动物园、大学与协会事务员",
  8: "P.8 回合/5张行动卡牌：强度 / X标记 / 卡牌升级 / 六种行动概览",
  9: "P.9 「卡牌」行动(等级 I/II) · 声望记录条和展示区 · 精选示例",
  10: "P.10 「建造」行动(等级 I/II) · 贩售亭距离 · 建造示例",
  11: "P.11 「动物」行动(等级 I)：打出五步骤 · 动物卡牌布局详解",
  12: "P.12 特殊饲养区(萌宠园/爬行馆/鸟禽馆) · 打出动物示例",
  13: "P.13 「动物」行动(等级 II) · 放置卡牌 · 动物类目 · 等级II示例",
  14: "P.14 「协会」行动(等级 I)：协会任务 · 协会板图",
  15: "P.15 保护项目工作 · 保护项目卡牌布局详解 · 打出示例",
  16: "P.16 放归动物示例 · 「协会」行动(等级 II)与捐赠",
  17: "P.17 「赞助商」行动(等级 I/II) · 赞助商卡牌布局详解",
  18: "P.18 「X标记」行动 · 魅力点数与保护点数 · 休息(步骤 1–5)",
  19: "P.19 休息(续) · 游戏结束与终局计分 · 决定胜利分示例",
  20: "P.20 单人游戏 · 难度等级/单人挑战 · 致谢名单与版权",
};

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function normalizePunct(t) {
  t = t.replace(new RegExp(`([${CJK}）】」”〕]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]):`, "g"), "$1：");
  t = t.replace(new RegExp(`([${CJK}）】」”〕])\\(`, "g"), "$1（");
  t = t.replace(new RegExp(`\\)([${CJK}（【“「〔])`, "g"), "）$1");
  return t;
}

function preprocess(n, text) {
  let t = text;
  // 去 H1 页眉行、页码行、分隔线、编辑注
  t = t.replace(/^# 规则书第.*$/gm, "");
  t = t.replace(/^# 海洋世界\s*$/gm, "");
  t = t.replace(/^（页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（页脚[^）]*）\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  t = t.replace(/^# 游戏结束与终局计分\s*$/gm, "## 游戏结束与终局计分");
  t = t.replace(/^# 单人游戏\s*$/gm, "## 单人游戏");
  t = t.replace(/^# 致谢名单\s*$/gm, "## 致谢名单");
  t = t.replace(/^## （续前页：休息的步骤）\s*$/gm, "## 休息（续）");
  // 收纳托盘类杂项整理注保持原样
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  // 〔图:…〕/〔图：…〕标记 → 行内斜体注
  out = out.replace(/〔图[:：]([^〕]*)〕/g, "<em>〔图 $1〕</em>");
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
    let text = line.trim();
    out.push(`<p>${inline(text)}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="方舟动物园规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(`<blockquote>
  <p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/F_CRdbW-HPnsSNYDQm8vhw" target="_blank" rel="noopener">「桌游怎么玩」《方舟动物园，Ark Nova【桌游规则】》</a>发布的《方舟动物园》(Ark Nova) 官方中文规则书（游人码头简体中文版，©2021 Feuerland，中文翻译：谭钧颐，全书 20 页含封面），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Feuerland Verlagsgesellschaft、游人心者及版权方所有，转录仅供个人学习查阅。</p>
  <p><small>整理说明：游人码头官译用语照录（「声望」「魅力」「保护点数」「协会事务员」「便签簿」「精选」「档案夹」「展示区」「饲养区/贩售亭/休憩亭」「萌宠园/爬行馆/鸟禽馆」「独有建筑」等）。原书用词与排印照录：「收纳托盘/收纳托盒」并存（P.4），「并提供了」「该地图适合在进行过首次游戏后的新手玩家」「优势的的」（P.4），「只不过一种是放置板块，而这种是移除事务员」（P.7），「包扩水域和岩石格」「且相邻水域格的饲养区」（P.12），「增加你动物园的魅力,点数」（P.13），「即使如果休息标记离抵达最终格不足」（P.17），「放置便签簿上」（P.18），「如果出现平局。则」（P.19），「详见下方的，」「交错)。则」、测试者「Christan Brinker」拼写（P.20），均为原书排印如此。P.4 个人设置图注与 P.17 地图图注中手写体小注依扫描分辨率部分无法辨认，已照实标注。〔图 …〕说明与部分小节标题为整理所拟；随书另附《术语表》与《图标概览》两本小册子（P.3 配件表「其它」所列），本页亦一并在扩展页收录其扩展版内容。</small></p>
</blockquote>`);

for (let n = 1; n <= 20; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(preprocess(n, readFrag(n))));
}

fs.writeFileSync(OUT, parts.join("\n\n") + "\n");
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
