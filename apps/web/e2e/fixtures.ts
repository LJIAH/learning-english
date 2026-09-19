import { test as base, expect, type Page } from "@playwright/test";

/** 伪造登录态：pinia 持久化结构（localStorage key = store id "user"），只含 UI 实际读取的字段 */
const LOGGED_IN_STATE = {
  user: {
    id: "test-user",
    name: "tester",
    avatar: null,
    wordNumber: 5,
    dayNumber: 3,
    accessToken: "fake-token",
  },
};

type Fixtures = {
  /** 已注入登录态的页面（在页面脚本执行前写入 localStorage，不依赖后端） */
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    await page.addInitScript((state) => {
      localStorage.setItem("user", JSON.stringify(state));
    }, LOGGED_IN_STATE);
    await use(page);
  },
});

export { expect };
