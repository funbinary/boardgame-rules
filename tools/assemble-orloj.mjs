// 把 content/_transcripts/orloj/ 下的 23 页转录片段装配为 games/orloj.html
// 用法: node tools/assemble-orloj.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "orloj");
const OUT = path.join(ROOT, "games", "orloj.html");
const IMG = "../assets/img/orloj";

// 每页插图题注
const CAPTIONS = {
  1: "规则书封面 · Orloj – The Prague Astronomical Clock(Perro Loko Games,中文翻译:陈斌华)",
  2: "P.2 介绍 · 公共配件清单",
  3: "P.3 玩家配件 · SOLO 配件 · 使徒行走装置的组装",
  4: "P.4 游戏设置 · 公共设置(钟面、行走装置、卷轴)",
  5: "P.5 公共设置(续) · 日历表盘抽取与助手堆设置",
  6: "P.6 个人玩家设置 · 锤子卡与初始资源",
  7: "P.7 一般概念:VP · 资源 · 偏差标记 · 工人",
  8: "P.8 精通进度轨道 · 钟表机构 · 仓库 · 回合结构",
  9: "P.9 激活钟表机制示例 · 跳过 · 资源生产",
  10: "P.10 精通与轨道奖励 · 拿取一个使徒",
  11: "P.11 激活月亮 · 移动画家 · 执行升级",
  12: "P.12 扩展工作室 · 建造",
  13: "P.13 建造示例(续) · 激活雕塑家 · 公鸡的叫声",
  14: "P.14 公鸡啼叫示例 · 额外行动 · 放置使徒",
  15: "P.15 支付硬币 · 使用卷轴 · 放置助手 · 声明目标 · 最终建造",
  16: "P.16 游戏结束计分 · 单人模式公共设置",
  17: "P.17 单人模式设置(续) · 约瑟夫·马内斯的配件设置",
  18: "P.18 马内斯行动卡的执行 · 单人游戏流程与回合特点",
  19: "P.19 马内斯的奖励与行动检查 · 第 3/6/9 回合结束",
  20: "P.20 SOLO 游戏结束 · 难度级别 · 游戏小贴士",
  21: "P.21 附录:图标说明(资源/奖励/钟面区域/行动)",
  22: "P.22 附录:助手/偏差/公鸡/普通目标/彩窗/皇家卷轴/锤子",
  23: "P.23 附录:锤子/卷轴/助手奖励/马内斯计分牌 · 历史短文 · 版权致谢",
  24: "封底 · Orloj(Perro Loko Games)",
};

const CJK = "\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef";

function readFrag(n) {
  return fs.readFileSync(path.join(SRC, `p${String(n).padStart(2, "0")}.md`), "utf8");
}

function normalizePunct(t) {
  // 半角逗号/冒号/括号(紧邻中文)统一为全角
  t = t.replace(new RegExp(`([${CJK}）】」”〕]),`, "g"), "$1，");
  t = t.replace(new RegExp(`,([${CJK}（【“「〔])`, "g"), "，$1");
  t = t.replace(new RegExp(`([${CJK}）】」”〕]):`, "g"), "$1：");
  t = t.replace(new RegExp(`([${CJK}）】」”〕])\\(`, "g"), "$1（");
  t = t.replace(new RegExp(`\\)([${CJK}（【“「〔])`, "g"), "）$1");
  return t;
}

function preprocess(n, text) {
  let t = text;
  // 去掉 H1 页眉行
  t = t.replace(/^# .*$/gm, "");
  // 去掉跨页续行编辑注与页脚页码行
  t = t.replace(/^\*（本页无新的小节标题[^）]*）\*\s*$/gm, "");
  t = t.replace(/^\(左栏接上页[^)]*\)\s*$/gm, "");
  t = t.replace(/^\(接上页,爱德华多建造示例第 4、5 步\)\s*$/gm, "");
  t = t.replace(/^\(页脚页码[:：]\d+\)\s*$/gm, "");
  // 行首缩进实体
  t = t.replace(/^(?:&nbsp;)+\s*/gm, "");
  // 附录页(21-23):补附录总标题,编号小节降为三级并加「附录」前缀
  if (n === 21) {
    t = t.replace(/^页眉[:：]\s*附录[:：]\s*图标说明\s*$/m, "## 附录：图标说明");
  }
  if (n >= 21 && n <= 23) {
    t = t.replace(/^## (\d+)\. (.*)$/gm, "### 附录 $1. $2");
    t = t.replace(/^## (版权|致谢)\s*$/gm, "### $1");
  }
  // 正文小节层级归一:各页代理标注不一,统一把二级编号小节降为三级(附录页除外)
  if (n <= 20) {
    t = t.replace(/^## (4\.[23]|5\.[567]|7\.2|8\.[2-9]|13\.1[01])([^\n]*)$/gm, "### $1$2");
    t = t.replace(/^### (8\.2\.1)\./gm, "#### $1.");
  }
  return normalizePunct(t);
}

function inline(s) {
  let out = s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  // 图注标记 → 行内斜体注
  out = out.replace(/【图[:：]([^】]*)】/g, "<em>〔图$1〕</em>");
  return out;
}

const CIRCLED = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟]/;

function mdToHtml(md, compMode) {
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
      out.push("<blockquote>\n" + mdToHtml(quote.join("\n"), false) + "\n</blockquote>");
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
    // 配件清单页:圈号/数字开头的连续短行 → 列表
    if (compMode && (CIRCLED.test(line.trim()[0]) || /^\d+\s/.test(line.trim()))) {
      const items = [];
      while (i < lines.length && lines[i].trim() &&
             (CIRCLED.test(lines[i].trim()[0]) || /^\d+\s/.test(lines[i].trim()))) {
        items.push(lines[i].trim());
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
  return `<figure>\n<img src="${IMG}/${nn}.jpg" alt="奥洛伊布拉格天文钟规则书第 ${n} 页扫描图" loading="lazy">\n<figcaption>${cap}</figcaption>\n</figure>`;
}

/* ---------- 主流程 ---------- */
const frags = {};
for (let n = 2; n <= 24; n++) frags[n] = preprocess(n, readFrag(n));

const parts = [];
parts.push(figure(1));
parts.push(`<blockquote>
<p>本页整理自微信公众号<a href="https://mp.weixin.qq.com/s/hZMk4x7_qZPONjyyrdQLYg" target="_blank" rel="noopener">「桌游怎么玩」《奥洛伊 布拉格天文钟[Orloj The Prague Astronomical Clock]》</a>发布的 Perro Loko Games《Orloj: The Prague Astronomical Clock》官方中文规则书（中文翻译：陈斌华，全书 24 页含封面封底），逐页全文转录，原书扫描图随文嵌入——<strong>点击任意图片即可放大查看</strong>。规则内容归 Perro Loko Games 及版权方所有，转录仅供个人学习查阅。</p>
<p><small>整理说明：原书官译用语（「奥尔洛伊」「使徒行走装置」「精通」「偏差」「金色公鸡」等）照录；正文称游戏名为「奥尔洛伊」，译者标题作「奥洛伊」，本页标题从译者题名。原书用词不一处均照录：「油漆/颜料」「钱币/硬币」「工作坊卡/工作室卡」「表盘/转盘」全书混用；P.7、P.13「拿拿取」重字，P.10「图标学」，P.15 两个「11.1.」小节标题，P.21 附录两个「1. 资源」小节标题，均为原书排印如此。P.4 版图左上数字牌无法完全确认是 53 还是 5.3；P.16 单人模式装饰件的小符号与 P.20 难度图标扫描分辨率下无法辨认，以〔符号〕〔困难符号〕占位。经人工逐页放大核对，存疑处两遍交叉验证。</small></p>
</blockquote>`);

for (let n = 2; n <= 24; n++) {
  parts.push(figure(n));
  parts.push(mdToHtml(frags[n], n === 2 || n === 3));
}

const BGG = {
  id: "429405", rating: "7.9", rank: "1049", weight: "3.61", users: "2200",
};
const chip = `<a class="meta-chip bgg-chip" href="https://boardgamegeek.com/boardgame/${BGG.id}" target="_blank" rel="noopener" title="BoardGameGeek：⭐综合评分 ${BGG.rating}，排名 #${BGG.rank}，权重/复杂度 ${BGG.weight}/5（1 轻松 ~ 5 重度），${BGG.users}人评分。点击查看原页面">⭐ BGG ${BGG.rating} · 排名 #${BGG.rank} · 权重 ${BGG.weight}/5 · ${BGG.users}人评分</a>`;

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
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="description" content="《奥洛伊：布拉格天文钟》（Orloj: The Prague Astronomical Clock）官方中文规则书全文转录：1–4 人布拉格天文钟构建题材，激活钟表机构/使徒行走装置/精通轨道/建造彩色玻璃窗目标，含单人对抗画家约瑟夫·马内斯模式，规则书扫描图随文嵌入。">
  <title>奥洛伊：布拉格天文钟 · 规则 — 桌游规则书</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🕰️</text></svg>">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body data-theme="orloj">

  <div class="progress-bar" aria-hidden="true"></div>

  <header class="topbar">
    <button class="menu-btn" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="../index.html">🎲 桌游规则书</a>
    <span class="topbar-title">奥洛伊：布拉格天文钟（Orloj）</span>
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
          <h1 class="game-title">🕰️ 奥洛伊：布拉格天文钟</h1>
          <p class="game-sub">Orloj: The Prague Astronomical Clock · 设计：Paloma J. Pascual / Abraham Sánchez · Perro Loko Games 出版（官方中文规则书全文转录，中文翻译：陈斌华）</p>
          <div class="meta-chips">
            ${chip}
            <span class="meta-chip">👥 1–4 人（含单人模式）</span>
            <span class="meta-chip">⏱️ 60–120 分钟</span>
            <span class="meta-chip">📖 官方中文规则书全文转录</span>
            <span class="meta-chip">🕰️ 布拉格天文钟机械</span>
            <span class="meta-chip">🪟 彩色玻璃窗构建</span>
          </div>
        </header>

${parts.join("\n\n")}

        <footer class="source-note">
<p>来源：微信公众号 <a href="https://mp.weixin.qq.com/s/hZMk4x7_qZPONjyyrdQLYg" target="_blank" rel="noopener">「桌游怎么玩」《奥洛伊 布拉格天文钟[Orloj The Prague Astronomical Clock]》</a>（Perro Loko Games《Orloj: The Prague Astronomical Clock》官方中文规则书，中文翻译：陈斌华）· 规则内容归 Perro Loko Games 及版权方所有，转录仅供个人学习查阅。</p>
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
