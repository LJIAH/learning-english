import { test, expect } from "./fixtures";

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

test("取消登录（Esc）→ 弹窗关闭、URL 不变、无未处理的 Promise 拒绝", async ({ page }) => {
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
