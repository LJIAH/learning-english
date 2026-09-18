#!/usr/bin/env node
/**
 * 前端产物体积报告（零依赖）
 *
 * 用法：
 *   pnpm --filter @en/web size-report            # 打印报告
 *   pnpm --filter @en/web size-report --strict   # 首屏超预算时以非 0 退出（CI / 发布前检查）
 *
 * 说明：
 * - “首屏资源”= dist/index.html 里直接引用的文件（script / modulepreload / stylesheet），
 *   其余为按需加载的 chunk，不占用首屏下载时间。
 * - gzip 体积用 Node 内置 zlib 计算，接近 nginx 开启 gzip 后的实际传输量。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(webRoot, "dist");
const assetsDir = join(distDir, "assets");

/** 首屏 JS + CSS 的 gzip 预算（KB） */
const BUDGET_KB = 200;
const strict = process.argv.includes("--strict");

const KB = (n) => `${(n / 1024).toFixed(1)} KB`;
const TEXT_ASSET = /\.(js|css)$/i;
const gzipSize = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

const indexPath = join(distDir, "index.html");
let html;
try {
  html = readFileSync(indexPath, "utf8");
} catch {
  console.error(`找不到 ${indexPath}，请先执行 pnpm --filter @en/web build`);
  process.exit(1);
}

// index.html 直接引用的资源 = 首屏必须下载的资源
const entrySet = new Set(
  [...html.matchAll(/\/assets\/([^"']+)/g)].map((m) => m[1]),
);

const rows = readdirSync(assetsDir)
  .filter((name) => statSync(join(assetsDir, name)).isFile())
  .map((name) => {
    const file = join(assetsDir, name);
    const size = statSync(file).size;
    return {
      name,
      size,
      // 图片等二进制资源不计 gzip（本来就不压缩）
      gz: TEXT_ASSET.test(name) ? gzipSize(file) : size,
      isText: TEXT_ASSET.test(name),
      entry: entrySet.has(name),
    };
  })
  .sort((a, b) => b.size - a.size);

const formatRow = (r) =>
  `  ${r.name.padEnd(32)} raw ${KB(r.size).padStart(9)}   gzip ${
    r.isText ? KB(r.gz).padStart(9) : "        -"
  }`;

const entryRows = rows.filter((r) => r.entry);
const lazyRows = rows.filter((r) => !r.entry);
const entryTotal = entryRows.reduce((acc, r) => acc + r.gz, 0);
const overBudget = entryTotal / 1024 > BUDGET_KB;

console.log("\n== 首屏资源（index.html 直接引用）==");
entryRows.forEach((r) => console.log(formatRow(r)));
console.log(
  `  ${"首屏合计".padEnd(30)} gzip ${KB(entryTotal).padStart(9)}   预算 ${BUDGET_KB} KB -> ${
    overBudget ? "超预算" : "OK"
  }`,
);

console.log("\n== 按需加载资源（进入对应路由/弹窗时才下载）==");
lazyRows.forEach((r) => console.log(formatRow(r)));

if (overBudget) {
  console.warn(
    `\n[体积预算] 首屏 gzip ${KB(entryTotal)} 已超过 ${BUDGET_KB} KB，请检查是否又把大依赖引入了首屏。`,
  );
  if (strict) process.exitCode = 1;
} else {
  console.log(`\n[体积预算] 首屏 gzip ${KB(entryTotal)}，未超过 ${BUDGET_KB} KB。`);
}
