import { test, expect } from "./fixtures";

// Step 2 冒烟：证明「配置链路可用 + 首页能渲染」。
// 选择器策略（语义优先）与登录门禁用例从 Step 3 开始展开。

test("首页可以打开，Header 与主 CTA 渲染正常", async ({ page }) => {
  await page.goto("/");

  // index.html 的 <title>
  await expect(page).toHaveTitle("English App");

  // Header 是原生 <header>，自带 banner landmark
  const header = page.getByRole("banner");
  await expect(header).toBeVisible();
  await expect(header.getByText("English App")).toBeVisible();

  // 首页主 CTA —— 后续「登录门禁」用例点的就是它
  await expect(page.getByRole("button", { name: "立即学习" })).toBeVisible();
});
