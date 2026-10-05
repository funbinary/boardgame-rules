// 把 content/_transcripts/white-castle/ 下的 18 页转录片段装配为 games/white-castle.html
// 《姬路城》(The White Castle) 官方中文规则书:封面+介绍页 + 印页 4–20(扫描件 18 张)
// 用法: node tools/assemble-white-castle.mjs && node tools/wire-white-castle-sidebar.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "white-castle");
const OUT = path.join(ROOT, "games", "white-castle.html");
const IMG = "../assets/img/white-castle";
const SELF = "white-castle.html";

// 每页插图题注
const CAPTIONS = {
  1: "封面 · The White Castle 姬路城 · 游戏介绍(背景 1761 播磨 · 1-4 人 · 约 80 分钟)",
  2: "游戏配件 · 77 张卡牌(玩家辅助/起始行动/起始资源/法令/地头/使节/大名/植物庭院/石头庭院/单人) · 板块与资源",
  3: "版图(4 张个人领地版图 · 1 张主版图) · 指示物配件(武士/家臣/园丁 · 资源方块 · 白鹭/影响力/扇子指示物 · 轮次标记 · 骰子)",
  4: "游戏设置 · 随机开局与卡牌流动",
  5: "游戏流程 · 一位玩家的回合 · 使用骰子的步骤 · 叠放骰子",
  6: "使用骰子的步骤(续) · 获得和支付钱币与大名家纹 · 获得和支付资源 · 地面区域 · 城堡",
  7: "墙外 · 水井",
  8: "个人领地 · 派遣家族成员至姬路城的朝堂 · 武士",
  9: "园丁 · 家臣(请求觐见 · 提升层级)",
  10: "大名家纹 · 灯笼奖励 · 时间流逝轨",
  11: "轮次结束 · 游戏结束(剩余资源计分 · 时间流逝计分)",
  12: "家族成员计分(在城堡中 · 在训练场 · 在庭院中) · 胜负判定",
  13: "终局计分完整示例(合计 76 家族分数)",
  14: "德川家族的到访 – 单人模式 · 游戏设置的变动(简单/中等/困难) · 游戏流程(印页 16)",
  15: "单人模式 · 骰子被选定之后的步骤 · 在每个轮次结束时(印页 17)",
  16: "单人模式 · 最终计分 · 单人图标(印页 18)",
  17: "单人模式示例 · 制作人员 · 设计者致谢(印页 19)",
  18: "附录 · 图标总表(印页约 20〔?〕,页脚页码被裁切)",
};

// 装配时整节剥离的转录员注记小节
const STRIP_HEAD = /^#{2,4} (疑似排印问题|组件数量加和自检|数量加和自检|其他说明|自检注)/;
// 降为四级标题的小节
const DEMOTE_HEAD = /^(示例卡牌文字|示例卡 |示例图|图注|图$|图（)/;
// 整行剥离的杂项
const STRIP_LINE = [/^印页[:：]/, /^页眉[:：]/, /^页首横幅章节名[:：]/, /^> ?转录说明[:：]/, /^转录说明[:：]/, /^# 规则书第 \d+ 页/, /^-{3,}$/];

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function preprocess(text) {
  const lines = text.split("\n");
  const out = [];
  let stripLevel = 0;
  for (const line of lines) {
    const hm = line.match(/^(#{1,6}) /);
    if (hm) {
      const level = hm[1].length;
      if (stripLevel && level <= stripLevel) stripLevel = 0;
      if (!stripLevel && STRIP_HEAD.test(line)) { stripLevel = level; continue; }
      if (stripLevel) continue;
      if (/^# 规则书第 \d+ 页/.test(line)) continue;
      let t = line;
      if (DEMOTE_HEAD.test(t.replace(/^#+ /, ""))) t = t.replace(/^#+ /, "#### ");
      const bm = t.match(/^(#{1,6} [^〔]*?)\s*〔(.+?)〕\s*$/);
      if (bm) {
        out.push(bm[1]);
        out.push("");
        out.push(`〔${bm[2]}〕`);
        continue;
      }
      out.push(t);
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
  out = out.replace(/〔(图[:：]|图 |转录注[:：]|图标[:：])([^〕]*)〕/g, "<em>〔$1$2〕</em>");
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
        + body.map(r => "<tr>" + r.map(c => `<td>${inline(c)}</td>`).join("\n") + "</tr>").join("\n")
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="姬路城规则书扫描图第 ${n} 张" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 1; n <= 18; n++) frags[n] = preprocess(readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/7Az5TS7gdIokcO6RNyON_w" target="_blank" rel="noopener">「宁小方510」《姬路城》中文规则书</a>一文发布的《姬路城》(The White Castle,Sheila Santos 与 Israel Cendrero 合作设计,Devir Games 出版,「圣瓦西里大教堂」《The Red Cathedral》系列第二作) 官方中文规则书扫描件,共 18 张(封面与游戏介绍 + 游戏配件至附录图标总表),逐页全文转录,原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Devir 及版权方所有,转录仅供个人学习查阅。</p>
<p><small>整理说明:〔图标:……〕表示此处为印刷图标/图形,非文字;〔图 ……〕说明为整理所拟;扫描件模糊或存疑处如实标〔?〕,未作推测补全。组件数量已核对加和——P.2 卡牌 4+6+9+3+15+12+9+5+5+9=77,与「77张 卡牌」横幅一致;P.13 终局计分示例 8+1+3+6+25+18+15=76 与正文自洽。原书括注页码照录:正文与附录中「见第 N 页」为原书页码体系,与扫描件页序不完全对应(如「游戏结束(见第14页)」实际位于扫描第 11 张;扫描第 14–17 张页脚可见印页 16–19,扫描第 18 张页脚页码被裁切,据序约当印页 20)。人名与专名照录原书(如「Nobuaki Takerube」「枝微末节」等),官译腔(地头/使节/大名/家臣/园丁/白鹭指示物等)一并保留。</small></p>
</blockquote>`);

for (let n = 1; n <= 18; n++) {
  if (n > 1) parts.push(figure(n));
  parts.push(mdToHtml(frags[n]));
}

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
  ["tulip-bubble.html", "🌷 郁金香泡沫"],
  ["trajan.html", "🦅 图拉真"],
  ["galileo-galilei.html", "🔭 伽利略：伽利莱"],
  ["orloj.html", "🕰️ 奥洛伊：布拉格天文钟"],
  ["food-chain-magnate.html", "🍔 快餐连锁大亨"],
  ["clank-catacombs.html", "🐉 CLANK! 地下墓穴"],
  ["clank-catacombs-underworld.html", "💀 CLANK! 地下墓穴:地下世界"],
  ["clank-adventuring-party.html", "🗡️ CLANK! 冒险队"],
  ["ark-nova-marine-worlds.html", "🐙 方舟动物园：海洋世界"],
  ["arnak-expedition-leaders.html", "🗿 阿纳克遗迹:探险队长"],
  ["speakeasy.html", "🎷 地下酒吧"],
  ["power-grid.html", "⚡ 电力公司"],
  ["seti.html", "🛰️ SETI：寻找外星人"],
  ["seti-space-agencies.html", "🚀 地外文明：太空机构"],
  ["white-castle.html", "🏯 姬路城"],
  ["endeavor-deep-sea.html", "🌊 奋进号：深海"],
  ["druids-of-edora.html", "🌲 埃多拉的德鲁伊"],
  ["grand-austria-hotel.html", "🏨 奥地利大饭店"],
  ["the-message.html", "🕵️ 风声再临"],
  ["gwt-new-zealand.html", "🐑 大西部开拓者:新西兰"],
  ["fields-of-arle.html", "🌾 阿勒農場"],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《姬路城》（The White Castle）官方中文规则书全文转录：3 轮×3 回合的桥梁骰子放置，城堡三层（城门/地头/使节/大名）、墙外与水井，武士·园丁·家臣三大行动，大名家纹与灯笼奖励，时间流逝轨四季检查点，单人模式「德川家族的到访」（简单/中等/困难），终局计分示例与附录图标总表，规则书扫描图随文嵌入。">
  <title>姬路城 (The White Castle) · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🏯</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="white-castle">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">姬路城</span>
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
${SIDEBAR_GAMES.filter(([href]) => href !== SELF).map(([href, name]) => `          <li><a href="${href}">${name}</a></li>`).join("\n")}
        </ul>
      </nav>
    </aside>
    <div class="backdrop" id="backdrop" aria-hidden="true"></div>

    <main class="content">
      <article>
        <header class="page-header">
          <h1 class="game-title">🏯 姬路城</h1>
          <p class="game-sub">The White Castle · 设计：Sheila Santos &amp; Israel Cendrero · Devir Games 出版 · 1–4 人 · 约 80 分钟（官方中文规则书全文转录）</p>
          <div class="meta-chips">
            <span class="meta-chip">👥 1–4 人</span>
            <span class="meta-chip">🤖 含单人模式</span>
            <span class="meta-chip">🎲 桥梁骰子放置</span>
            <span class="meta-chip">🏯 城堡三层·庭院·训练场</span>
            <span class="meta-chip">📖 中文规则书全文转录</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/7Az5TS7gdIokcO6RNyON_w" target="_blank" rel="noopener">「宁小方510」《姬路城》中文规则书</a>（The White Castle 官方中文规则书扫描件）· 规则内容归 Devir 及版权方所有，转录仅供个人学习查阅。</p>
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
