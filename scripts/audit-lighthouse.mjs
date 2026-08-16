#!/usr/bin/env bun

import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = 8188;
const chromePath =
  process.env.CHROME_PATH ||
  resolve(process.env.HOME || "", ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
};

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(projectRoot, rel);
  if (!filePath.startsWith(`${projectRoot}/`)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

const chrome = await launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
});

const flags = {
  port: chrome.port,
  output: "json",
  logLevel: "error",
  onlyCategories: ["performance", "accessibility"],
};

const { lhr, report } = await lighthouse(`http://127.0.0.1:${port}/index.html`, flags);
await chrome.kill();
await new Promise((resolve) => server.close(resolve));

const score = (name) => lhr.categories[name].score;
const audit = (name) => lhr.audits[name]?.numericValue ?? null;
const performance = Math.round(score("performance") * 100);
const accessibility = Math.round(score("accessibility") * 100);
const lcp = audit("largest-contentful-paint");
const cls = audit("cumulative-layout-shift");
const fcp = audit("first-contentful-paint");
const tbt = audit("total-blocking-time");

await mkdir(resolve(projectRoot, ".lighthouse"), { recursive: true });
await writeFile(resolve(projectRoot, ".lighthouse", "report.json"), report, "utf8");

console.log(`Lighthouse 结果 (${lhr.lighthouseVersion}):`);
console.log(`Performance:     ${performance}/100`);
console.log(`Accessibility:   ${accessibility}/100`);
console.log(`LCP:             ${lcp !== null ? `${(lcp / 1000).toFixed(2)}s` : "n/a"}`);
console.log(`FCP:             ${fcp !== null ? `${(fcp / 1000).toFixed(2)}s` : "n/a"}`);
console.log(`CLS:             ${cls !== null ? cls.toFixed(3) : "n/a"}`);
console.log(`TBT:             ${tbt !== null ? `${Math.round(tbt)}ms` : "n/a"}`);
console.log(`报告文件: .lighthouse/report.json`);
console.log(
  "注意: INP 需要 DevTools Performance 交互 trace 单独验证，Lighthouse 在无真实交互样本时可能不提供 INP。",
);

if (performance < 95 || accessibility < 95) {
  console.error("未达到性能预算: Performance >= 95 且 Accessibility >= 95");
  process.exitCode = 1;
}