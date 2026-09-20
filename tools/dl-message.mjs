import { execFileSync } from "node:child_process";
import fs from "node:fs";

const list = fs.readFileSync("d:/project/rules/_tmp/msg_urls_u.txt", "utf8")
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
console.log("url 行数:", list.length);

// 页序 = url 行序；第 2 行与第 1 行内容重复(页面连贴两次)，跳过 → 17 页
const jobs = [];
let page = 0;
for (let i = 0; i < list.length; i++) {
  if (i === 1) continue;
  page++;
  jobs.push([list[i], String(page).padStart(2, "0") + ".jpg"]);
}
console.log("待下载:", jobs.length);

for (const [url, name] of jobs) {
  const out = "d:/project/rules/assets/img/the-message/" + name;
  execFileSync("curl", ["-s", "-A",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "-e", "https://www.gstonegames.com/", "https://" + url, "-o", out]);
  const sz = fs.statSync(out).size;
  if (sz < 10000) { console.error("过小,疑似失败:", name, sz); process.exit(1); }
  console.log(name, sz);
}
