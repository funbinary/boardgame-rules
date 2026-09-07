// 批量抓取 BGA doc wiki 的全部 Gamehelp* 页面（渲染后的 HTML）
// 可断点续传：已存在的 raw/<slug>.json 跳过
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"); // 项目根
const RAW_DIR = path.join(ROOT, "_bga", "raw");
fs.mkdirSync(RAW_DIR, { recursive: true });

const TITLES = JSON.parse(fs.readFileSync(path.join(ROOT, "_bga", "all-titles.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slug = (t) => t.replace(/^Gamehelp/, "").replace(/[^A-Za-z0-9_-]/g, "_");
const UA = "bgules-personal-site/1.0 (personal rules reference; contact: local)";

let done = 0, skipped = 0, failed = 0;
const redirects = {}; // requested slug -> resolved title
const log = fs.createWriteStream(path.join(ROOT, "_bga", "fetch.log"), { flags: "a" });
const say = (m) => { log.write(m + "\n"); };

console.log(`共 ${TITLES.length} 页`);
for (const title of TITLES) {
  const s = slug(title);
  const file = path.join(RAW_DIR, s + ".json");
  if (fs.existsSync(file) && fs.statSync(file).size > 100) { skipped++; continue; }

  const url = "https://en.doc.boardgamearena.com/api.php?action=parse&page=" +
    encodeURIComponent(title) +
    "&prop=text|displaytitle&redirects=1&disabletoc=1&disableeditsection=1&disablelimitreport=1&format=json";

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.error) throw new Error("api:" + data.error.code);
    fs.writeFileSync(file, JSON.stringify(data));
    // 记录重定向/规范化后的最终标题
    const finalTitle = data.parse.title;
    if (finalTitle && finalTitle !== title) redirects[s] = finalTitle;
    done++;
    if (done % 50 === 0) {
      const msg = `进度 ${done + skipped}/${TITLES.length}（本次已完成 ${done}，跳过 ${skipped}，失败 ${failed}）`;
      console.log(msg); say(msg);
    }
  } catch (e) {
    failed++;
    say(`失败 ${title}: ${e.message}`);
    console.log(`失败 ${title}: ${e.message}`);
  }
  await sleep(220); // 限速，礼貌抓取
}
fs.writeFileSync(path.join(ROOT, "_bga", "redirects.json"), JSON.stringify(redirects, null, 1));
console.log(`完成。成功 ${done}，跳过 ${skipped}，失败 ${failed}`);
say(`完成。成功 ${done}，跳过 ${skipped}，失败 ${failed}`);
