// 校验全站 SEO 注入结果：JSON-LD 可解析、canonical/og 标签齐全
// 用法：node tools/check-seo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = ["index.html", "account.html"];
for (const f of fs.readdirSync(path.join(ROOT, "games"))) {
  const p = path.join("games", f);
  if (f.endsWith(".html")) files.push(p);
  else if (fs.statSync(path.join(ROOT, p)).isDirectory()) {
    for (const b of fs.readdirSync(path.join(ROOT, p)).filter((x) => x.endsWith(".html"))) {
      files.push(path.join(p, b));
    }
  }
}

let bad = 0;
let noLd = 0;
let checked = 0;
for (const rel of files) {
  const html = fs.readFileSync(path.join(ROOT, rel), "utf8");
  checked++;
  const hasCanonical = /<link rel="canonical" href="https:\/\/zhibinai\.cn\//.test(html);
  const hasOg = /<meta property="og:title"/.test(html);
  if (!hasCanonical || !hasOg) {
    console.log(`MISSING TAGS: ${rel} canonical=${hasCanonical} og=${hasOg}`);
    bad++;
  }
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) {
    console.log(`NO JSON-LD: ${rel}`);
    noLd++;
    continue;
  }
  for (const [, raw] of blocks) {
    try {
      const data = JSON.parse(raw);
      if (data["@context"] !== "https://schema.org" || !Array.isArray(data["@graph"])) {
        console.log(`BAD SHAPE: ${rel}`);
        bad++;
      }
    } catch (e) {
      console.log(`JSON PARSE FAIL: ${rel}: ${e.message}`);
      bad++;
    }
  }
}

console.log(`checked=${checked} pages, parse-fail/bad-shape=${bad}, no-ld=${noLd}`);
process.exit(bad || noLd ? 1 : 0);
