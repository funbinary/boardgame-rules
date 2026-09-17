// 把 content/_transcripts/seti/ 下的 28 页转录片段装配为 games/seti.html
// P.1 封面, P.2-21 主规则(多人), P.22-26 单人游戏, P.27 任务/游戏结束/CREDITS, P.28 规则提示/FAQ 参考插页
// 用法: node tools/assemble-seti.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "seti");
const OUT = path.join(ROOT, "games", "seti.html");
const IMG = "../assets/img/seti";

// 每页插图题注
const CAPTIONS = {
  1: "封面 · SETI：寻找外星人 · INSTRUCTION MANUAL · 翻译 & 排版：陈斌华",
  2: "游戏配件 · 主版图 · 玩家配件 · 单人游戏组件",
  3: "公共配件（48 块科技板块 · 主牌库 138 张卡牌等） · 外星人配件（五大外星物种）",
  4: "设置①–⑤ · 主版图 · 外星人物种 · 太阳系版图 · 卡牌行 · 信誉/能量堆 · 数据",
  5: "设置⑦–⑪ · 金色计分板块 · 中立里程碑 · 科技版图与科技 · 轮次结束卡牌 · 太阳系旋转指示物",
  6: "玩家设置 · 起始资源 · 增加收入",
  7: "游戏概述 · 卡牌概述 · 回合结构 · 自由行动 · 主行动（示例卡 Herschel Space Observatory） · 轮次结构",
  8: "发射一个探测器 · 移动",
  9: "太阳系版图特写 · 便签：太阳不是一个区域 · 探测器变身着陆器 · 宣传示例",
  10: "绕行星运行（轨道卫星） · 示例：木星版图",
  11: "登陆行星或卫星（着陆器） · 标记生命痕迹",
  12: "扫描附近的恒星 · 示例卡 Johnson Space Center",
  13: "扇形区域 · 标记信号 · 完成扇区 · 重置扇区",
  14: "分析数据 · 放置数据 · 数据容量",
  15: "分析数据（续） · 任务卡（有条件的任务 · 可触发任务） · 游戏终局计分卡",
  16: "研究科技 · 旋转太阳系 · 示例卡 Large Hadron Collider",
  17: "探测器科技 · 望远镜科技 · 计算机科技（PT/TT/CT #01–04）",
  18: "里程碑 · 多个里程碑 · 资源转换 · 购买卡牌",
  19: "弃权不行动 · 轮次之间 · 获取卡牌的其他方式 · 重新填满卡牌行",
  20: "发现外星物种 · 发现 · 外星卡牌 · 深入研究 · 溢出区域",
  21: "发现外星物种（续） · 金色计分板块（科技 · 任务 · 收入 · 其他）",
  22: "单人游戏 · 设置 · 对手行动牌库 · 目标堆栈",
  23: "单人游戏：对手资源 · 进度轨道 · 对手的计算机 · 对手宣传点 · 对手胜利点",
  24: "单人游戏：对手的回合 · 对手的行动（科技 · 使用科技板块 · 发射）",
  25: "单人游戏：轨道卫星/着陆器 · 望远镜 · 生命痕迹",
  26: "单人游戏：分析 · 物种发现 · 弃权不行动 · 目标",
  27: "任务（7 条） · 游戏结束 · CREDITS",
  28: "参考插页 · 规则提示 · 卡片术语 · 设置提醒 · FAQ",
};

// 装配时整节剥离的转录员注记小节（要点已并入页首整理说明）
const STRIP_HEAD = /^#{2,4} (疑似排印问题|组件数量加和自检|数量加和自检|其他说明|自检注)/;
// 裸段落注记头(其后直至文末均为转录员注记)
const STRIP_TAIL = /^疑似排印问题(清单)?[:：]?\s*$/;
// 降为四级标题（保留内容、不进目录）的小节
const DEMOTE_HEAD = /^(示例卡牌文字|示例图版文字|示例图内文字|示例卡 \d|版图照片印刷文字|图内印刷文字|页面视觉元素|页面纯视觉元素|纯视觉元素|顶部通栏大图图注|底部四联示例图说明|图注|图$|图（|A GAME BY|SPECIAL THANKS|THANK YOU TO ALL TESTERS)/;
// 整行剥离的杂项
const STRIP_LINE = [/^印页[:：]/, /^页首横幅章节名[:：]/, /^> ?转录说明[:：]/, /^转录说明[:：]/, /^-{3,}$/];

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function preprocess(text) {
  const lines = text.split("\n");
  const out = [];
  let stripLevel = 0; // 0 = 不在剥离区
  let tailStrip = false; // 文末裸段落注记区
  for (const line of lines) {
    if (STRIP_TAIL.test(line.trim())) { tailStrip = true; continue; }
    if (tailStrip) continue;
    const hm = line.match(/^(#{1,6}) /);
    if (hm) {
      const level = hm[1].length;
      if (stripLevel && level <= stripLevel) stripLevel = 0; // 剥离区结束
      if (!stripLevel && STRIP_HEAD.test(line)) { stripLevel = level; continue; }
      if (stripLevel) continue;
      let t = line;
      if (DEMOTE_HEAD.test(t.replace(/^#+ /, ""))) t = t.replace(/^#+ /, "#### ");
      else if (t.startsWith("## 示例卡牌文字")) t = t.replace(/^## /, "### ");
      // 标题尾随的〔…〕图注说明移出标题,避免污染目录
      const bm = t.match(/^(#{1,6} [^〔]*?)\s*〔(.+?)〕\s*$/);
      if (bm) {
        out.push(bm[1]);
        out.push("");
        out.push(`〔${bm[2]}〕`);
        continue;
      }
      out.push(t.replace(/^## 分析数据（页首横幅下正文）$/, "## 分析数据"));
      continue;
    }
    if (stripLevel) continue;
    if (STRIP_LINE.some(re => re.test(line))) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/〔(图[:：]|图 |转录注[:：])([^〕]*)〕/g, "<em>〔$1$2〕</em>");
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
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!/^[\s:|-]+$/.test(lines[i])) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push('<div class="table-wrap">\n<table>\n<thead>\n<tr>' + head.map(c => `<th>${inline(c)}</th>`).join("") + "</tr>\n</thead>\n"
        + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("\n")
        + "\n</table>\n</div>");
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
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        if (/^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*[-*]\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      out.push("<ul>\n" + items.map((it) => `  <li>${inline(it)}</li>`).join("\n") + "\n</ul>");
      continue;
    }
    if (/^\s*\d+[.、)]\s+/.test(line)) {
      // 收集列表项(条目间允许空行);按字面序号回落处切分,保证编号与原书一致
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)[.、)]\s+(.*)$/);
        if (m) { items.push({ num: Number(m[1]), text: m[2] }); i++; continue; }
        if (!lines[i].trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && /^\s*\d+[.、)]\s+/.test(lines[j])) { i = j; continue; }
        }
        break;
      }
      const runs = [];
      for (const it of items) {
        const last = runs[runs.length - 1];
        if (!last || it.num <= last[last.length - 1].num) runs.push([it]);
        else last.push(it);
      }
      out.push(runs.map(run => {
        const start = run[0].num !== 1 ? ` start="${run[0].num}"` : "";
        return `<ol${start}>\n` + run.map(it => `  <li>${inline(it.text)}</li>`).join("\n") + `\n</ol>`;
      }).join("\n"));
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="SETI 规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 28; n++) frags[n] = preprocess(readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/GhvVuSu4sZ7t4qG1jQfHhA" target="_blank" rel="noopener">「桌游怎么玩」寻找外星人【桌游规则】SETI（1–14）</a>与<a href="https://mp.weixin.qq.com/s/dsypcaYiXezRAdvcCrifjQ" target="_blank" rel="noopener">《单人游戏规则》SETI（15–28）</a>两篇文章发布的《SETI：寻找外星人》(SETI: Search for Extraterrestrial Intelligence，Tomáš Holek 设计，CGE 出版) 中文规则书扫描件（翻译 &amp; 排版：陈斌华）。全书 28 页逐页全文转录（P.1 封面、P.2–21 多人主规则、P.22–26 单人游戏规则、P.27 任务/游戏结束/CREDITS、P.28 规则提示与 FAQ 参考插页），原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 CGE 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：〔图标：……〕表示此处为印刷图标/令牌图片，非文字；〔图 …〕说明为整理所拟。组件清单已逐项核对加和——P.2 玩家配件明示数量合计 99 件，P.3 公共配件 48+12+1+2+4+138+30+30+70＝335 件、外星人配件五组 19+19+19+16+15＝88 件。原书排印问题较多，均照录并加〔原文如此〕：破折号多处印作「--」（P.1/P.6/P.7/P.15/P.16/P.19）；P.4「数据」节序号与上节重复印作 5、「每颗的恒星」「外星物种板」；P.5「科技板块洗牌」「轮次过关后」；P.8「行星版图上的数字不属于“太空中的探测器”」主语不谐；P.9「宣传图标 的」内空格；P.10「覆盖区域」疑漏字；P.11 两处「登陆器」与通篇「着陆器」不一；P.12「标记 1 信号。(详见下页)。」标点重复；P.13「完成扇形」「赢得该区」「因为橙色最后一个标记。」等残句漏字、「重置扇区」两条标注重复；P.14「塞进一张牌作为收入」、括号与句号叠用；P.15「如果当你打出……时」「放在面前」疑漏「你」；P.16「(见下框)。」句号重复、「放置数据」疑漏「指示物」、「图形」「转动」用词不一；P.17「这已经适用于」「费用 与」「描绘的奖励」「匹配扇形」；P.18「购买卡牌」栏作「3 点宣传」而他处作「信誉」；P.19「将自己选择一张牌」「结算收入问题」「补充替换」；P.20「外星人版图」与通篇「外星版图」不一、「进行游戏」搭配生硬；P.21「每种科技中你拥有最少的科技得分」；P.22「给对手一种颜色所有配件」脱「的」、翻开 3 块板块后接「这将是你的第一个目标」；P.23「信誉、能量和卡牌」之「和」、「通过或帮助发现」语句不通、「对手也会在进度轨道上前进」整句连印两次；P.24「卡片/卡牌」「2 点奖励/2 分」用词不一；P.25「两个第一个区域」「标记最多标记的区域」、扇区/区段/区域混用；P.26「)。」叠句、「进度轨」疑漏「道」；P.27 测试者「Krauz」「Sťař」拼写罕见；P.28 问句作「区域」答句作「扇区」。扫描件右缘裁切致 P.28 三处行尾字残缺（「两个中〔?〕里程碑」「两个中立〔?〕里程碑」「一个能量〔?〕换一个信誉」），已标〔?〕。P.2 单人两组件 ITEM 编号、部分卡面英文风味小字及图中行星徽章二进制小数字无法确辨，均如实标注。〔原文此段印于底框/彩色字体〕等为整理对版式的客观描述。</small></p>
</blockquote>`);

for (let n = 1; n <= 28; n++) {
  if (n > 1) parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

// BGG 评分（浏览器实测 boardgamegeek.com/boardgame/418059,2026-09）
const BGG = { id: "418059", rating: "8.4", rank: "14", weight: "3.84", users: "22000" };
const chip = `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${BGG.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${BGG.rating}，排名 #${BGG.rank}，权重/复杂度 ${BGG.weight}/5（1 轻松 ~ 5 重度），${BGG.users}人评分。点击查看原页面">⭐ BGG ${BGG.rating} · 排名 #${BGG.rank} · 权重 ${BGG.weight}/5 · 2.2万人评分</a>`;

const SIDEBAR_GAMES = [
  ["7-wonders.html", "🏛️ 七大奇迹"],
  ["brass-birmingham.html", "🏭 工业革命：伯明翰"],
  ["vale-of-eternity.html", "✨ 永恒之谷"],
  ["wingspan.html", "🦜 展翅翱翔"],
  ["pokemon-grove.html", "🌳 宝可梦林地探索"],
  ["puerto-rico.html", "⛵ 波多黎各"],
  ["barcelona.html", "🌸 巴塞罗那"],
  ["dune-imperium.html", "🏜️ 沙丘：帝国"],
  ["dune-imperium-uprising.html", "🪱 沙丘：帝国起义"],
  ["ascension.html", "🃏 创升纪元"],
  ["trajan.html", "🦅 图拉真"],
  ["tulip-bubble.html", "🌷 郁金香泡沫"],
  ["galileo-galilei.html", "🔭 伽利略：伽利莱"],
  ["orloj.html", "🕰️ 奥洛伊：布拉格天文钟"],
  ["food-chain-magnate.html", "🍔 快餐连锁大亨"],
  ["clank-catacombs.html", "🐉 CLANK! 地下墓穴"],
  ["ark-nova-marine-worlds.html", "🐙 方舟动物园：海洋世界"],
  ["speakeasy.html", "🎷 地下酒吧"],
  ["power-grid.html", "⚡ 电力公司"],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《SETI：寻找外星人》（SETI: Search for Extraterrestrial Intelligence）中文规则书全文转录：1–4 人太空探索重策，发射探测器、绕行星运行、登陆采样、扫描恒星标记信号、分析数据、发现外星生命，含研究科技、里程碑、任务卡、金色计分与获胜规则，并附完整单人游戏规则、规则提示与 FAQ，规则书扫描图随文嵌入。">
  <title>SETI：寻找外星人 · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🛰️</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="seti">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">SETI：寻找外星人</span>
  </header>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <nav class="toc" aria-label="本页目录">
        <div class="toc-title">本页目录</div>
        <ul id="toc-list"></ul>
      </nav>
      <nav aria-label="全部游戏">
        <div class="toc-title">全部游戏</div>
        <ul>
          <li><a href="../index.html">🏠 返回首页</a></li>
${SIDEBAR_GAMES.map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🛰️ SETI：寻找外星人</h1>
          <p class="game-sub">SETI: Search for Extraterrestrial Intelligence · 设计：Tomáš Holek · CGE 出版 · 1–4 人（中文版规则书全文转录，含单人游戏规则）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">⏱️ 40–160 分钟左右</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
            <span class="meta-chip">🛰️ 探测 · 扫描 · 发现外星生命</span>
            <span class="meta-chip">🤖 附单人游戏规则与 FAQ</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/GhvVuSu4sZ7t4qG1jQfHhA" target="_blank" rel="noopener">「桌游怎么玩」寻找外星人【桌游规则】SETI（1–14）</a>、<a href="https://mp.weixin.qq.com/s/dsypcaYiXezRAdvcCrifjQ" target="_blank" rel="noopener">《单人游戏规则》SETI（15–28）</a>（《SETI：寻找外星人》中文规则书扫描件）· 规则内容归 CGE 及版权方所有，转录仅供个人学习查阅。</p>
</footer>
      </article>
    </main>
  </div>

  <button class="to-top" aria-label="返回顶部">↑</button>
  <script src="../assets/js/main.js"></script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`written ${OUT} (${fs.statSync(OUT).size} bytes)`);
