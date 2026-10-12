import { test, expect } from "./fixtures";

// 冒烟：证明「配置链路可用 + 首页能渲染」。
// 选择器策略：语义选择器（getByRole）优先，不依赖 class（与 Vue 版一致）。

test("首页可以打开，Header 与主 CTA 渲染正常", async ({ page }) => {
  await page.goto("/");

  // index.html 的 <title>（React 版是 "English App · React"，用正则兼容两版）
  await expect(page).toHaveTitle(/English App/);

  // Header 是原生 <header>，自带 banner landmark
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  await expect(header.getByText("English App")).toBeVisible();

  // 首页主 CTA —— 「登录门禁」用例点的就是它
  await expect(page.getByRole("button", { name: "立即学习" })).toBeVisible();
});
