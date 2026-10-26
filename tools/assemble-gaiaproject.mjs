// 把 content/_transcripts/gaiaproject/ 下的 19 页转录片段装配为 content/bga-zh/gaiaproject.html
// 《盖亚计划》(Gaia Project) 官方中文规则书(繁体中文版):扫描印页 1-19
// 用法: node tools/assemble-gaiaproject.mjs && node tools/build-bga.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "content", "_transcripts", "gaiaproject");
const OUT = path.join(ROOT, "content", "bga-zh", "gaiaproject.html");
const IMG = "../../assets/img/bga/gaiaproject";

// 每页插图题注(对应原书印页)
const CAPTIONS = {
  1: "封面 · 蓋亞計劃 · 簡介與目錄",
  2: "遊戲配件(上) · 遊戲版圖板塊",
  3: "遊戲配件(下) · 卡牌/建築和其它標記 · 致謝",
  4: "遊戲設置 · 遊戲版圖 / 開發面板和聯邦標記",
  5: "遊戲設置 · 計分面板 / 回合助推板塊和其它配件",
  6: "遊戲設置 · 挑選種族 / 你的種族面板",
  7: "遊戲設置 · 放置你的第一個建築 / 回合助推板塊 / 中立玩家",
  8: "目標和遊戲流程",
  9: "能量循環",
  10: "六回合的遊戲流程(收入/蓋亞/行動/清理)",
  11: "行動 1) 建造一個礦產基地",
  12: "改造費用 · 行動 2) 進行一次蓋亞計劃",
  13: "行動 3) 升級已有的建築 · 科技板塊",
  14: "行動 4) 建立一個聯邦",
  15: "建立聯邦示例 · 行動 5) 提升研究等級 · 行動 6) 能量行動",
  16: "行動 7) 特殊行動 · 8) 放棄 · 9) 被動行動:吸取能量",
  17: "行動 10) 快速行動 · 階段 IV:清理",
  18: "遊戲結束和計分 · 進階設置(上)",
  19: "進階設置(下) · 可變版圖/行動順序 · 智腦遊戲模式指引",
};

const STRIP_LINE = [/^# 规则书第 \d+ 页/, /^-{3,}$/];

function preprocess(text) {
  return text
    .split("\n")
    .filter((line) => !STRIP_LINE.some((re) => re.test(line.trim())))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inline(s) {
  let out = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  return out;
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const hm = line.match(/^(#{1,6}) /);
    if (hm) {
      // 片段「# 页题」在预处理中保留作锚定,这里二级及以下直接映射 h2-h4(页面目录收 h2/h3)
      const level = Math.min(Math.max(hm[1].length, 2), 4);
      out.push(`<h${level}>${inline(line.slice(hm[1].length + 1))}</h${level}>`);
      i++;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`      <li>${inline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push("    <ul>\n" + items.join("\n") + "\n    </ul>");
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`      <li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`);
        i++;
      }
      out.push("    <ol>\n" + items.join("\n") + "\n    </ol>");
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    // 连续普通段落
    const paras = [];
    let buf = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6} |[-*] |\d+\. )/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    paras.push(buf.join(" "));
    for (const p of paras) out.push(`    <p>${inline(p)}</p>`);
  }
  return out.join("\n");
}

const BLOCKQUOTE = `<blockquote>
  <p>本页整理自《蓋亞計劃》(Gaia Project,Helge Ostertag &amp; Jens Drogemüller 設計,Feuerland Spiele 出版)官方中文規則書(繁體中文版,游人碼頭發行),微信公眾號「桌游怎么玩」所載 19 頁掃描圖逐頁轉錄,並在對應章節嵌入原書掃描頁對照——<strong>點擊任意掃描頁即可放大查看</strong>。內容涵蓋簡介與目錄、遊戲配件、遊戲設置(版圖/開發面板/計分面板/種族挑選/首建築/回合助推板塊/中立玩家)、目標和遊戲流程、能量循環、六回合四階段流程、十大行動(建造礦產基地/蓋亞計劃/升級建築/建立聯邦/提升研究/能量與量子智能方塊行動/特殊行動/放棄/吸取能量/快速行動)、遊戲結束計分與進階設置(可變版圖/可變行動順序)。規則內容歸版權方所有,轉錄僅供個人學習查閱。</p>
  <p><small>整理說明:掃描頁經雙遍 OCR 轉錄並逐項複核,組件數量自檔自洽(回合计分板塊 4×1+3×2=10✓;基礎科技 9×4=36✓;聯邦標記 6 種×3+1 枚格倫〔?〕星人專用=19✓;單人模式卡牌印頁 3 標題記 25 張而五項明細加和為 30,疑「包括」僅涵蓋種族/行動順序/智腦三項(7+1+17=25),照錄備考)。原書目錄所列附錄(印頁 20-24:種族/回合助推板塊·回合计分板塊/開發面板·行動格/科技板塊)及單人智腦規則為獨立冊頁,未隨本篇掃描收錄。種族名「晶礦〔?〕星人」「格倫〔?〕星人」按多遍裁讀並經擴展《失落的艦隊》第 16 页十八種族總覽交叉驗證(擴展版總覽作「晶星人」);個別無法確認的字以〔?〕標注,〔圖:〕〔側注〕為版面插圖/旁注佔位說明;原書為繁體中文版,轉錄保留繁體字形。擴展《蓋亞計劃:失落的艦隊》規則書見站內<a href="../gaiaproject-lost-fleet.html">獨立頁面</a>。</small></p>
</blockquote>`;

const parts = [];
for (let n = 1; n <= 19; n++) {
  const nn = String(n).padStart(2, "0");
  const md = preprocess(fs.readFileSync(path.join(SRC, `p${nn}.md`), "utf8"));
  parts.push(
`<figure>
  <img src="${IMG}/${nn}.jpg" alt="《蓋亞計劃》規則書印頁 ${n}:${CAPTIONS[n]}" loading="lazy">
  <figcaption>印頁 ${n} · ${CAPTIONS[n]}</figcaption>
</figure>

${mdToHtml(md)}`
  );
}

const html = parts[0].replace(/^<figure>/, `${BLOCKQUOTE}\n\n<figure>`) + "\n\n" + parts.slice(1).join("\n\n") + "\n";
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`OK ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB, 19 页)`);
