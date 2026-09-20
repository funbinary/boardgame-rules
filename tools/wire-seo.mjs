// 为现有静态页注入 SEO/GEO 头部：<link rel="canonical"> + Open Graph + Twitter Card + JSON-LD（WebSite/WebPage/BreadcrumbList）
// 覆盖 account.html、games/*.html、games/bga/*.html（index.html 的头与其可见 FAQ 手工维护，勿在此重复注入）
// 幂等：已含 application/ld+json 的文件跳过。用法：node tools/wire-seo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://zhibinai.cn";
const SITE_NAME = "桌游规则书";

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pick(re, html) {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function firstImage(html) {
  // 页面内引用的资源图（扫描页/规则图），归一化为站点绝对路径
  const m = html.match(/(?:src|href)="((?:\.\.\/)*assets\/(?:img|bga-img)\/[^"]+\.(?:jpe?g|png|webp))"/i);
  if (!m) return "";
  return `${BASE}/${m[1].replace(/^(\.\.\/)+/, "")}`;
}

function gameName(title) {
  // “七大奇迹 · 规则 — 桌游规则书” -> “七大奇迹”
  return title.replace(/\s*·\s*规则\s*—\s*桌游规则书\s*$/, "").trim() || title;
}

function buildJsonLd({ url, title, desc, image, dateModified, breadcrumbName }) {
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${BASE}/#website`,
      name: SITE_NAME,
      url: `${BASE}/`,
      inLanguage: "zh-CN",
      description: "免费中文桌游规则书查询站：热门桌游完整中文规则全文 + Board Game Arena 全量官方规则中文版。",
    },
    {
      "@type": "WebPage",
      "@id": url,
      url,
      name: title,
      description: desc,
      isPartOf: { "@id": `${BASE}/#website` },
      inLanguage: "zh-CN",
      dateModified,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首页", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: breadcrumbName, item: url },
      ],
    },
  ];
  if (image) graph[1].primaryImageOfPage = { "@type": "ImageObject", url: image };
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 1);
}

function buildBlock({ url, title, desc, image, jsonLd, ogType, noindex = false }) {
  const lines = [];
  if (noindex) lines.push(`<meta name="robots" content="noindex">`);
  lines.push(`<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="zh_CN">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
  );
  if (image) lines.push(`<meta property="og:image" content="${image}">`);
  lines.push(`<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`);
  lines.push(`<meta name="twitter:title" content="${esc(title)}">`);
  lines.push(`<meta name="twitter:description" content="${esc(desc)}">`);
  lines.push(
    `<script type="application/ld+json">${jsonLd}</script>`,
    `<!-- seo-wired -->`,
  );
  return lines.map((l) => "  " + l).join("\n");
}

let wired = 0;
let skipped = 0;

function wire(relFile, { ogType = "article", noindex = false } = {}) {
  const abs = path.join(ROOT, relFile);
  let html = fs.readFileSync(abs, "utf8");
  if (html.includes("application/ld+json")) {
    skipped++;
    return;
  }
  const url = relFile === "account.html" ? `${BASE}/account.html` : `${BASE}/${relFile.replace(/\\/g, "/")}`;
  const title = pick(/<title>([^<]*)<\/title>/, html);
  const desc = pick(/<meta\s+name="description"\s+content="([^"]*)"/, html);
  const image = firstImage(html);
  const dateModified = fs.statSync(abs).mtime.toISOString().slice(0, 10);
  const jsonLd = buildJsonLd({
    url,
    title,
    desc,
    image,
    dateModified,
    breadcrumbName: gameName(title),
  });
  const block = buildBlock({ url, title, desc, image, jsonLd, ogType, noindex });
  if (!html.includes("</head>")) throw new Error(`${relFile}: no </head>`);
  html = html.replace("</head>", `${block}\n</head>`);
  fs.writeFileSync(abs, html, "utf8");
  wired++;
}

// account.html：用户收藏工具页，不参与索引
wire("account.html", { ogType: "website", noindex: true });

for (const f of fs.readdirSync(path.join(ROOT, "games")).filter((x) => x.endsWith(".html"))) {
  wire(path.join("games", f));
}

const bgaDir = path.join(ROOT, "games", "bga");
for (const f of fs.readdirSync(bgaDir).filter((x) => x.endsWith(".html"))) {
  wire(path.join("games", "bga", f), { ogType: "article" });
}

console.log(`wired: ${wired}, skipped(already has ld+json): ${skipped}`);
