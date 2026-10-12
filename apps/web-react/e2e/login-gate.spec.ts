import { test, expect } from "./fixtures";

// 登录门禁：首页 CTA 的「未登录先弹登录、登录后再跳转」链路。
// 这条链路是跨模块接线（组件 → useLogin 状态机 → router），单元测试天然漏掉。
// 前 3 条与 Vue 版 apps/web/e2e/login-gate.spec.ts 一一对应。

test("未登录点「立即学习」→ 弹出登录弹窗、URL 不变", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "立即学习" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("已登录点「立即学习」→ 直接进入 /chat", async ({ loggedInPage: page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("tester")).toBeVisible();

  await page.getByRole("button", { name: "立即学习" }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("取消登录（Esc）→ 弹窗关闭、URL 不变、无未处理的 Promise 拒绝", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as Window & { __unhandledRejections?: string[] };
    w.__unhandledRejections = [];
    window.addEventListener("unhandledrejection", (event) => {
      w.__unhandledRejections?.push(String(event.reason));
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "立即学习" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL("/");

  // 回归守卫：Esc 取消会 reject openLogin 的 Promise，调用方必须 catch（历史上曾漏过）
  const rejections = await page.evaluate(
    () =>
      (window as Window & { __unhandledRejections?: string[] })
        .__unhandledRejections ?? [],
  );
  expect(rejections).toEqual([]);
});

// React 版独有：路由级登录守卫（Vue 版只有「点导航」时守，直接输 URL 不受保护）。
// 未登录直接访问 /chat、/setting 会被 redirect 回首页并提示。
test("未登录直接访问 /chat → 被弹回首页并提示", async ({ page }) => {
  await page.goto("/chat");

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status")).toContainText("请先登录");
});
