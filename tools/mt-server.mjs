// 一次性 MT 辅助服务器：
// GET  /mt-jobs.json → 任务队列（带 CORS）
// POST /results      ← 页面回传译文（合并写入 _bga/mt-results.json）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JOBS = path.join(ROOT, "_bga", "mt-jobs.json");
const RESULTS = path.join(ROOT, "_bga", "mt-results.json");

let results = {};
try { results = JSON.parse(fs.readFileSync(RESULTS, "utf8")); } catch {}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const p = path.join(ROOT, "_bga", path.basename(req.url));
    fs.createReadStream(fs.existsSync(p) ? p : JOBS).pipe(res);
    return;
  }
  if (req.method === "POST" && req.url === "/results") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 20e6) req.destroy(); });
    req.on("end", () => {
      try {
        const incoming = JSON.parse(body);
        Object.assign(results, incoming);
        fs.writeFileSync(RESULTS, JSON.stringify(results));
        res.writeHead(200); res.end(JSON.stringify({ saved: Object.keys(incoming).length, total: Object.keys(results).length }));
      } catch (e) { res.writeHead(400); res.end(e.message); }
    });
    return;
  }
  res.writeHead(404); res.end();
});
server.listen(18081, () => console.log("MT helper on http://localhost:18081"));
