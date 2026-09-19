import { defineConfig } from "@playwright/test";
import { Config } from "@en/config";

// 两种运行目标（决策见 docs/testing/e2e-plan.md 第四节）：
// - 默认：跑 dev server（:8080）——日常写用例，启动快
// - E2E_PROD=1：先 build 再 preview 生产产物（:4173）——发布前验证/本机冒烟
const isProd = !!process.env.E2E_PROD;

const PORT = isProd ? 4173 : Config.ports.web;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",

  // 本地失败不自动重跑：红了就是真的红了；
  // CI 下重试 2 次用于识别 flaky（"重跑才过"即 flaky），trace 也只在重试时才有意义
  retries: process.env.CI ? 2 : 0,

  // list：终端实时输出；html：失败现场报告（pnpm exec playwright show-report 打开）
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // 用例里 page.goto("/") 的相对路径都基于这里
    baseURL: BASE_URL,

    // 第一次重试时保留完整 trace（DOM 快照/网络/控制台），失败后可逐步回放；
    // 平时不产生额外开销
    trace: "on-first-retry",
    // 失败的时候，截图保存到 ./e2e/screenshots 下
    screenshot: "only-on-failure",
  },

  // Playwright 自动管理被测服务：跑之前拉起，跑完关掉；
  // 本地若已手动开着同端口服务则直接复用（reuseExistingServer），不会报端口占用
  webServer: {
    command: isProd
      ? "pnpm build-only && pnpm exec vite preview --port 4173"
      : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // prod 模式要先 build，给足时间
  },
});
