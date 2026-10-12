#!/usr/bin/env node
/**
 * 前端产物体积报告（零依赖，Vue / React 共用）
 *
 * 由 apps/web/scripts/size-report.mjs 抽离而来：两版之间唯一的差异是
 * 「产物目录」和「首屏预算」，都做成了参数，所以不绑定任何具体应用。
 *
 * 用法：
 *   pnpm --filter @en/web size-report
 *   pnpm --filter @en/web size-report --strict              # 超预算时非 0 退出（CI / 发布前检查）
 *   pnpm --filter @en/web-react size-report --budget 320
 *   size-report --root apps/web --dist apps/web/dist --budget 200 --strict
 *
 * 参数：
 *   --root <dir>     应用根目录（其下应有 dist/ 与 package.json），默认当前工作目录
 *   --dist <dir>     产物目录，默认 <root>/dist
 *   --budget <KB>    首屏 JS+CSS 的 gzip 预算，默认 200
 *   --strict         超预算时以非 0 退出
 *   -h, --help       显示本帮助
 *
 * 说明：
 * - “首屏资源” = dist/index.html 里直接引用的文件（script / modulepreload / stylesheet），
 *   其余为按需加载的 chunk，不占用首屏下载时间。
 * - gzip 体积用 Node 内置 zlib 计算，接近 nginx 开启 gzip 后的实际传输量。
 * - 两个前端的产物体积差异很大（React 版首屏含 three.js），所以预算按应用给，
 *   不要用同一个数字去套。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, join, resolve } from "node:path";

const argv = process.argv.slice(2);

/**
 * 取值参数：支持 `--name value` 与 `--name=value` 两种写法。
 * 同名出现多次时取**最后一个** —— 因为 pnpm 是把命令行参数「追加」在脚本后面的，
 * 例如 package.json 里写了 `size-report --budget 320`，再执行
 * `pnpm --filter @en/web-react size-report --budget 100` 时实际 argv 是
 * `--budget 320 --budget 100`，取最后一个才能让命令行覆盖脚本里的默认值。
 */
const getArg = (name, fallback) => {
  for (let i = argv.length - 1; i >= 0; i--) {
    const a = argv[i];
    if (a === name) return argv[i + 1] ?? fallback;
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
  }
  return fallback;
};
const hasFlag = (...names) => names.some((n) => argv.includes(n));

if (hasFlag("-h", "--help")) {
  // 直接打印文件头的用法说明，避免维护两份文档
  const self = readFileSync(new URL(import.meta.url), "utf8");
  const block = self.slice(self.indexOf("/**") + 3, self.indexOf("*/"));
  console.log(
    block
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim(),
  );
  process.exit(0);
}

const KB = (n) => `${(n / 1024).toFixed(1)} KB`;
const TEXT_ASSET = /\.(js|css)$/i;
const gzipSize = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

const root = resolve(getArg("--root", process.cwd()));
const distDir = resolve(getArg("--dist", join(root, "dist")));
const budgetKb = Number(getArg("--budget", "200"));
const strict = hasFlag("--strict");

if (!Number.isFinite(budgetKb) || budgetKb <= 0) {
  console.error(`--budget 需要是正数，收到：${getArg("--budget", "")}`);
  process.exit(2);
}

/** 应用名（仅用于输出可读性）：<root>/package.json 的 name，取不到则用目录名 */
const appName = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (pkg.name) return pkg.name;
  } catch {
    // 没有 package.json 或解析失败：退回目录名
  }
  return basename(root);
})();

const assetsDir = join(distDir, "assets");
const indexPath = join(distDir, "index.html");

let html;
try {
  html = readFileSync(indexPath, "utf8");
} catch {
  console.error(
    `找不到 ${indexPath}\n请先构建该应用（例如 pnpm --filter ${appName} build）`,
  );
  process.exit(1);
}

// index.html 直接引用的资源 = 首屏必须下载的资源
const entrySet = new Set(
  [...html.matchAll(/\/assets\/([^"']+)/g)].map((m) => m[1]),
);

let assetNames;
try {
  assetNames = readdirSync(assetsDir);
} catch {
  console.error(`找不到产物目录 ${assetsDir}，请先构建该应用`);
  process.exit(1);
}

const rows = assetNames
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
const overBudget = entryTotal / 1024 > budgetKb;

console.log(
  `\n[size-report] ${appName}  dist: ${distDir}  首屏预算: ${budgetKb} KB(gzip)`,
);

console.log("\n== 首屏资源（index.html 直接引用）==");
entryRows.forEach((r) => console.log(formatRow(r)));
console.log(
  `  ${"首屏合计".padEnd(30)} gzip ${KB(entryTotal).padStart(9)}   预算 ${budgetKb} KB -> ${
    overBudget ? "超预算" : "OK"
  }`,
);

console.log("\n== 按需加载资源（进入对应路由/弹窗时才下载）==");
lazyRows.forEach((r) => console.log(formatRow(r)));

if (overBudget) {
  console.warn(
    `\n[体积预算] 首屏 gzip ${KB(entryTotal)} 已超过 ${budgetKb} KB，请检查是否又把大依赖引入了首屏。`,
  );
  if (strict) process.exitCode = 1;
} else {
  console.log(
    `\n[体积预算] 首屏 gzip ${KB(entryTotal)}，未超过 ${budgetKb} KB。`,
  );
}
