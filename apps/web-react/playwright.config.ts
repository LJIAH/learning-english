import { defineConfig } from "@playwright/test";
import { Config } from "@en/config";

// 两种运行目标（与 Vue 版 apps/web/playwright.config.ts 同一套决策）：
// - 默认：跑 dev server（:8081）——日常写用例，启动快
// - E2E_PROD=1：先 build 再 preview 生产产物（:4174）——发布前验证/本机冒烟
//
// 端口与 Vue 版错开（dev 8081 vs 8080、preview 4174 vs 4173），两版可以同时跑 e2e。
const isProd = !!process.env.E2E_PROD;

const PORT = isProd ? 4174 : Config.ports.web + 1;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // 预热 dev server（见 e2e/global-setup.ts）：先把首页与登录弹窗链路
  // 编译一遍，避免首轮用例撞上 vite 首编译/依赖重预构建引发的超时
  globalSetup: "./e2e/global-setup.ts",

  // 本地失败不自动重跑：红了就是真的红了；
  // CI 下重试 2 次用于识别 flaky（"重跑才过"即 flaky），trace 也只在重试时才有意义
  retries: process.env.CI ? 2 : 0,

  // ★ dev 模式串行跑（workers: 1）—— 与并发无关的功能，是被测页面的渲染特性决定的：
  //   首页 Hologram 是持续 requestAnimationFrame 的 three.js 场景，headless 下走
  //   SwiftShader 软件光栅化，单个实例就吃掉一个 CPU 核心；2 个 worker 并发时两个
  //   实例互抢 CPU（任务管理器里就是两个 chrome-headless-shell 把 CPU 打满），
  //   首屏加载和 vite 首次编译一起被拖进超时区 —— 表现为最先并发的两条用例
  //   （login-gate #1 / smoke）超时失败，且失败与用例逻辑无关。
  //   串行后互不争抢，实测总耗时反而更短（每条 3~5s，首条含冷编译）。
  //   prod 是已构建产物、首屏轻，保留 Playwright 默认并发。
  workers: isProd ? undefined : 1,

  // ★ 单条用例超时（dev 60s / prod 90s，都宽于默认 30s）：
  //   - dev 60s：首次运行时依赖预构建 + three.js 首屏在 2 个 worker 并发下
  //     会超过 30s，报错为 "page.goto: Test timeout" 或 "Tearing down
  //     context exceeded" —— 断言逻辑本身没问题，属环境冷启动慢；
  //   - prod 90s：本机 Windows 上跑 preview 时，浏览器 context 的收尾（close）
  //     偶尔会超过 30s，报 "Tearing down \"context\" exceeded the test timeout"。
  timeout: isProd ? 90_000 : 60_000,

  // list：终端实时输出；html：失败现场报告（pnpm exec playwright show-report 打开）
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // 用例里 page.goto("/") 的相对路径都基于这里
    baseURL: BASE_URL,

    // 第一次重试时保留完整 trace（DOM 快照/网络/控制台），失败后可逐步回放
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // 断言超时给到 10s（默认 5s）：prod 模式下首个用例要等首屏三件套
  // （主包 ~1MB + 3D 模型 + 懒加载 chunk）冷启动，5s 偏紧
  expect: { timeout: 10_000 },

  // Playwright 自动管理被测服务：跑之前拉起，跑完关掉；
  // 本地若已手动开着同端口服务则直接复用（reuseExistingServer），不会报端口占用
  //
  // ★ prod 的 build 放在 npm script 里（test:e2e:prod），不放进这个命令：
  //   一是让 preview 从已经稳定的 dist 启动，避免「build 刚写完就被读」的冷启动抖动；
  //   二是命令只有一层进程，Windows 上收尾更容易杀干净。
  webServer: {
    command: isProd ? "vite preview --port 4174" : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
