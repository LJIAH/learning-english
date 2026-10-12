import { create } from "zustand";

/**
 * 全局搜索弹窗状态 —— 对应 Vue 版 hooks/useSearch.ts。
 *
 * Vue 用模块级 ref + 模块级快捷键监听；React 侧换成 zustand store（与 useLogin 同形），
 * 状态同样在模块级：**快捷键在模块加载时就绑定，不依赖组件是否挂载**。
 *
 * 为什么不让 Search 组件自己持有 isShow：那样组件必须常驻页面，
 * 会把它依赖的 axios / 接口层一起拖进首屏包。现在 App.tsx 按需挂载组件，
 * 快捷键始终可用。
 */
interface SearchState {
  isShowSearch: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useSearch = create<SearchState>()((set) => ({
  isShowSearch: false,

  openSearch: () => {
    document.body.style.overflow = "hidden"; // 隐藏滚动条
    set({ isShowSearch: true });
  },

  closeSearch: () => {
    document.body.style.overflow = "auto"; // 恢复滚动条
    set({ isShowSearch: false });
  },
}));

/**
 * 快捷键绑定 —— 模块加载时执行一次（等价于 Vue 版 bindShortcut 的 shortcutBound 判断）。
 *
 * 标记挂在 window 上而不是模块变量上：dev 下改这个文件会触发 HMR 重新执行模块，
 * 模块变量会重置、监听器就会重复注册；挂 window 才能跨热更新保持唯一。
 * （重复注册本身幂等无害，但会在调试时让人误以为按一次键触发了两次。）
 */
const BOUND_FLAG = "__enSearchShortcutBound";

if (typeof window !== "undefined") {
  const flags = window as unknown as Record<string, unknown>;
  if (!flags[BOUND_FLAG]) {
    flags[BOUND_FLAG] = true;
    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === "f") {
        event.preventDefault();
        useSearch.getState().openSearch();
        return;
      }
      // Vue 版只在打开时才响应 Esc；这里多调一次 closeSearch 是幂等空操作
      if (event.key === "Escape") {
        useSearch.getState().closeSearch();
      }
    });
  }
}
