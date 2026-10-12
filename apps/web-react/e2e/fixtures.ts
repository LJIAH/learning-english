import { test as base, expect, type Page } from "@playwright/test";

/**
 * 伪造登录态：zustand persist 的持久化结构（localStorage key = "en-user"），
 * 只含 UI 实际读取的字段，不依赖后端。
 *
 * 与 Vue 版 fixtures 的差异：Vue 用 pinia，localStorage 里直接就是 state 本身；
 * React 的 zustand persist 会包一层 `{ state, version }`，所以这里多这层壳。
 */
const LOGGED_IN_STATE = {
  state: {
    user: {
      id: "test-user",
      name: "tester",
      avatar: null,
      bio: "",
      wordNumber: 5,
      dayNumber: 3,
      accessToken: "fake-token",
    },
  },
  version: 0,
};

type Fixtures = {
  /** 已注入登录态的页面（在页面脚本执行前写入 localStorage，不依赖后端） */
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    await page.addInitScript((state) => {
      localStorage.setItem("en-user", JSON.stringify(state));
    }, LOGGED_IN_STATE);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- use 是 Playwright fixture 的约定参数，不是 React Hook
    await use(page);
  },
});

export { expect };
