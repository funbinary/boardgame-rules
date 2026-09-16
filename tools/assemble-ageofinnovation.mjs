// 把 content/_transcripts/ageofinnovation/ 下的 24 页转录片段装配为 content/bga-zh/ageofinnovation.html(BGA 页源片段)
// 用法: node tools/assemble-ageofinnovation.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "ageofinnovation");
const OUT = path.join(ROOT, "content", "bga-zh", "ageofinnovation.html");
const IMG = "../../assets/img/bga/ageofinnovation";

// 每页插图题注
const CAPTIONS = {
  1: "规则书封面 · Age of Innovation（Helge Ostertag · Feuerland，中文翻译&排版：陈斌华）",
  2: "P.2 配件清单（版图 / 书本 / 地形板块 / 各类板块）",
  3: "P.3 配件总览（发明 / 宫殿 / 钱币 / 中立与七色木质配件） · 游戏目标 · 目录",
  4: "P.4 游戏设置：公共设置步骤 ①–⑥ 与轮次计分板块规则",
  5: "P.5 设置步骤 ⑦–⑪ · 派系和规划展示版图的分配 · 变体指引",
  6: "P.6 个人公共设置 ①–⑨ · 放置你的起始车间",
  7: "P.7 公共概念：获得分数(A–E) · 魔力循环 · 原生地形和改造",
  8: "P.8 相邻和抵达 · 从建筑获得魔力（含例外情况 a）",
  9: "P.9 例外情况 b · 设立一座城市 · 中立建筑",
  10: "P.10 科学展示版图（四学科五规则） · 游戏流程 · 阶段 I: 收入",
  11: "P.11 阶段 II: 行动 · 改造并建造 · 地形改造与三种特殊情况",
  12: "P.12 特殊情况(续) · 建造 1 车间 · 改造并建造举例",
  13: "P.13 升级 1 个建筑：A 车间→公会 / B 公会→宫殿 / C 公会→学校 / D 学校→大学",
  14: "P.14 升级航海 · 升级改造 · 开发一项发明",
  15: "P.15 派遣 1 学者 · 魔力和书本行动 · 特殊行动",
  16: "P.16 略过（四步骤） · 额外选项：资源转换",
  17: "P.17 阶段 III: 科学奖励和为下一轮做准备 · Credits · 出版社信息",
  18: "P.18 游戏结束和最终计分（区域/科学/资源） · 变体规则：轮抽",
  19: "P.19 2 人游戏规则 · 附录 I: 规划展示版图特殊能力（7 地形）",
  20: "P.20 附录 II: 派系（12 派系详解）",
  21: "P.21 附录 III: 发明板块（特殊能力 / 即时分数 / 额外建筑）",
  22: "P.22 附录 IV: 宫殿板块（①–⑰ 全览）",
  23: "P.23 附录 V: 轮次奖励板块 · 附录 VI: 魔力和书本行动 · 附录 VII: 城市板块",
  24: "P.24 附录: 能力板块（12 种） · 轮次计分板块（12 种） · 最终轮次计分板块",
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
  t = t.replace(/^# 规则书第.*$/gm, "");
  t = t.replace(/^（页码[^）]*）\s*$/gm, "");
  t = t.replace(/^（页脚[^）]*）\s*$/gm, "");
  t = t.replace(/^（页面[^）]*页码[^）]*）\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
  // 横幅标注行与标题规整
  t = t.replace(/^（页首横幅标题）游戏概念\s*$/gm, "");
  t = t.replace(/^## 游戏概念（页首蓝色横幅标题）\s*$/gm, "## 游戏概念");
  t = t.replace(/^## 游戏流程（页中蓝色横幅标题）\s*$/gm, "## 游戏流程");
  t = t.replace(/^## （设置步骤 7–11，接上页）\s*$/gm, "## 游戏设置（续：步骤 ⑦–⑪）");
  t = t.replace(/^## （页底提示框）\s*$/gm, "### 变体指引（提示框）");
  t = t.replace(/^## 承上页续文（左栏顶部，无小节标题）\s*$/gm, "## 从建筑获得魔力（续）");
  t = t.replace(/^## （左栏，接上页"3 种特殊情况可能会发生"）\s*$/gm, "## 改造并建造（续）");
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="大创造时代规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(`<blockquote>
  <p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/g4Hbz6PNH9wXF1KnnIwqfQ" target="_blank" rel="noopener">「桌游怎么玩」《大创造时代，神秘大地，Age of Innovation【桌游规则-简体中文-非官方】》</a>发布的《Age of Innovation》非官方简体中文规则书（Helge Ostertag 设计，Feuerland 出版，中文翻译&排版：陈斌华，全书 24 页含封面），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Feuerland Verlagsgesellschaft、Capstone Games 及版权方所有，转录仅供个人学习查阅。</p>
  <p><small>整理说明：页面标题从 BGA 译名「大创造时代」，书内译者题名《创新时代》，本页侧栏与题图保留两种称谓；此为玩家非官方译本（陈斌华翻译排版），非出版社官方中文规则书。原书排印问题较多，均照录并加〔原文如此〕：P.4 公共设置步骤印制顺序为 ①③②④；「放置游戏版图上的」缺「在」（P.4）、「规划显示」（P.5）、「7 个学者和 3 桥梁」缺量词（P.6）、「相邻、一旦」（P.8）、「然而，然而」「免费黑桃」（P.9）、「都分布需要」（P.10）、「都以及略过」「执行你想要任何行动」（P.11）、「搬出地形格」「1 粽子书本」（P.13）、「未来激活」（P.15）、「TRADEING ROUTES」（P.16）、「Mike Martins, 7Nathan Morse」（衍字 7，P.17 Credits 原书即如此）、「Cincinatti」（P.17）、「立即进入有结束」（P.17）、「其他 3 为玩家」「地位标记笔其他所有人」、科学计分第三名正文印「4 分」而版图照片印「3.→2」（P.18）、「提升到货超过 8 级」（P.19）、「应用与 12 级」「在游戏开始时。」、奥马尔段首误植「航海家」（P.20）、「每当你建筑公会时」（P.23）、P.24 两个附录标题均误印「附录 VI」（按目录应为附录 VIII/IX）、「法工程学科」「其他其他」等。〔图 …〕说明与个别小节标题为整理所拟。</small></p>
</blockquote>`);

for (let n = 1; n <= 24; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(preprocess(n, readFrag(n))));
}

fs.writeFileSync(OUT, parts.join("\n\n") + "\n");
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
