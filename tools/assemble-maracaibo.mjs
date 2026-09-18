// 把 content/_transcripts/maracaibo-zh/ 下的 24 页转录片段装配为 content/bga-zh/maracaibo.html(BGA 页源片段)
// 来源:官方繁体中文规则书 PDF(gokids/艾賜魔袋台灣),子代理逐页转录+全量图文复核后 OpenCC 转简
// 用法: node tools/assemble-maracaibo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "maracaibo-zh");
const OUT = path.join(ROOT, "content", "bga-zh", "maracaibo.html");
const IMG = "../../assets/img/bga/maracaibo";

// 每页插图题注
const CAPTIONS = {
  1: "P.1 游戏背景 · 游戏配件（所有权标记 / 任务板块 / 故事板块 / 265 张卡牌 / 达布隆 / 城市与传承板块 / 版图等）",
  2: "P.2 初次游戏前的游戏设置：游戏版图（步骤 ①–⑨ 与 *注意）",
  3: "P.3 玩家设置（步骤 ⑩–⑭） · 第一场游戏（⑮–⑰） · 从第二局游戏开始",
  4: "P.4 游戏流程 · 阶段A) 航行 · 阶段B) 主要行动 · 阶段C) 抽牌",
  5: "P.5 自由行动 · 阶段C) 抽牌补充至手牌上限 · 主要行动：城市行动与战斗",
  6: "P.6 战斗奖励（达布隆/影响力/分数/棋子） · 战斗指示物顶部修正 · 获得影响力 · 吞并或驱逐 · 影响力记录条",
  7: "P.7 探索 · 探索者记录条奖励",
  8: "P.8 其他城市行动（9 块城市行动板块） · 村庄行动",
  9: "P.9 完成任务 · 故事板块 · 助手行动 · 放置位置问答与分数指示物",
  10: "P.10 返航（地点 20 / 21a / 21b / 22） · 中程计分（第一至第三轮结束）",
  11: "P.11 终局计分（第四轮结束） · 国家排名奖励 · 艾力克斯计分示例",
  12: "P.12 游戏结束 · 游戏之后 · 生涯卡牌 · 船只升级",
  13: "P.13 新的村庄行动 · 即时效果 · 卡牌说明（玛丽·里德示例卡） · 购买卡牌",
  14: "P.14 卡牌效果（收入/持续/助手/即时） · 协作指示物 · 收入记录条",
  15: "P.15 持续效果 · 助手行动 · 即时效果 · 荣誉建筑 · 任务",
  16: "P.16 单人变体模式：游戏设置 · 游戏流程 · 简的行动 · 难度等级表",
  17: "P.17 单人卡牌行动（续） · 额外规则 · 简与传承板块",
  18: "P.18 游戏结束（单人变体模式） · 符号概览：收入效果 / 持续效果与额外行动",
  19: "P.19 单人卡牌概览：新的村庄行动 · 新的战斗行动 · 即时效果",
  20: "P.20 单人卡牌概览：即时效果（续） · 助手行动",
  21: "P.21 单人卡牌概览：船只升级（续） · 荣誉建筑 · 购买需求",
  22: "P.22 生涯卡牌概览 · 故事卡牌概览 · 故事任务要求与奖励",
  23: "P.23 任务和故事任务要求 · 任务和故事任务奖励 · 传承板块 · 制作名单与设计师留言",
  24: "P.24 传承板块说明（L1–L25） · 游戏版图全图",
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
  t = t.replace(/^（頁碼[^）]*）\s*$/gm, "");
  t = t.replace(/^（页脚[^）]*）\s*$/gm, "");
  t = t.replace(/^-{3,}\s*$/gm, "");
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
    let text = line.trim();
    out.push(`<p>${inline(text)}</p>`);
    i++;
  }
  return out.join("\n\n");
}

function figure(n) {
  const nn = String(n).padStart(2, "0");
  const cap = CAPTIONS[n] || `规则书第 ${n} 页`;
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="马拉开波规则书第 ${n} 页" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const parts = [];
parts.push(`<blockquote>
  <p>本页整理自<a href="https://shop.capstone.hk/products/maracaibo-chi-ver" target="_blank" rel="noopener">Capstone 香港《馬拉開波 中文版》商品页</a>提供的<a href="https://www.gokids.com.tw/tsaiss/gokids/rules/%E9%A6%AC%E6%8B%89%E9%96%8B%E6%B3%A2_%E6%B0%B4%E5%8D%B0.pdf" target="_blank" rel="noopener">线上规则说明书 PDF</a>——《Maracaibo》官方繁体中文规则书（Alexander Pfister 设计，Game's Up! / dlp games 出版，繁体中文翻译/校稿：Gazza.Liu、James Wu，平面设计：Gru.Tsow，中文翻译文字与排版归艾賜魔袋台灣有限公司所有，全书 24 页），逐页全文转录并转写为简体，原书页面随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归版权方所有，转录仅供个人学习查阅。</p>
  <p><small>整理说明：全文按官方繁体版逐页视觉转录、全量图文复核后机械转写为简体，官译用语照录（达布隆=doubloon、简=单人模式对手、协作指示物=synergy token 等）。原书排印问题均照录并加〔原文如此〕：P.2「B类卡牌：故事卡牌……」并列分句间印冒号（疑应为分号）、步骤⑥印作「6*」（与「*注意」框呼应）；P.5 步骤「1.」后无空格而「2.」后有；P.6「将影响力记录条上，你该在战斗国家的标记往右移动一格」句式生硬、「部分战斗指示物顶部有额外的战斗修正，影响国家的战斗值」句疑未完；P.7「所有在之后越过这些分界线探索者的其他玩家」疑漏「的」；P.11 乘号印作字母「x」（3 处）；P.12「插入自己的船只板块」与他处「船只面板」用词不一、「花费了至少2-4点移动点数」；P.14「例子：」与他处「范例：」用词不一、「将任何超出的达布隆收入都会转换为」疑衍「将」；P.17 传承板块两条标点全半角不一；P.18「简的影响力标记计分如同玩家一样计算」语义重复、「使用有#MaracaiboGame」的「有」字突兀；P.19「战斗值」「战斗国家」与他处「战斗点数」术语不一；P.20「从你的船只移除一枚圆片」漏「面板」；P.23「花费过至少4点移动点数」语序疑误；P.24 L9 段「玩家便有了 一个新的」衍空格。原书手写体「将」字形似简体，系该字体对「爿」旁的写法（P.13/P.14 已核）。P.2 版图照片上的棕色序号圆标「15」为原版规则书编号残留，本页步骤仅 ①–⑨。〔图 …〕说明与个别小节标题为整理所拟。</small>
</blockquote>`);

for (let n = 1; n <= 24; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(preprocess(n, readFrag(n))));
}

fs.writeFileSync(OUT, parts.join("\n\n") + "\n");
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
