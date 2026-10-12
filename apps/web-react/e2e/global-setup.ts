import { chromium } from "@playwright/test";
import { Config } from "@en/config";

// 只预热 dev（vite 按需编译）；prod 是已构建产物，无需预热
const isProd = !!process.env.E2E_PROD;
const PORT = isProd ? 4174 : Config.ports.web + 1;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * 预热 dev server —— 解决「首轮用例被 vite 编译拖垮」的 flaky。
 *
 * 背景：vite dev 按需编译。一轮测试里第一个访问首页的用例要现场编译整个
 * 首页模块图；点击「立即学习」时又要实时编译懒加载的 Login chunk，若期间
 * 发现未预构建的依赖，还会触发依赖重预构建 + 页面 full reload（弹窗状态
 * 随之丢失）。这些开销都落在用例内部，表现为 goto/click 超时或
 * "dialog 10s 内不出现"的偶发失败（与用例逻辑无关）。
 *
 * 这里用真实浏览器先把「首页加载 + 打开登录弹窗」完整走一遍，把编译和
 * 重载提前消化掉；后续用例面对的就是已经热好的 dev server。
 * 预热失败不抛错（不阻塞测试），真实用例会重新走一遍并给出可读的失败原因。
 */
export default async function globalSetup() {
  if (isProd) return;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 120_000 });

    // 重试 3 轮：若依赖重预构建触发 full reload，弹窗会被冲掉，需重走
    for (let i = 0; i < 3; i++) {
      await page
        .getByRole("button", { name: "立即学习" })
        .click({ timeout: 15_000 })
        .catch(() => {});

      const opened = await page
        .waitForSelector('[role="dialog"]', { timeout: 60_000 })
        .then(() => true)
        .catch(() => false);

      if (opened) break;

      await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {});
    }
  } catch {
    // 预热是 best-effort：失败时保持沉默，交给真实用例暴露问题
  } finally {
    await browser.close();
  }
}
