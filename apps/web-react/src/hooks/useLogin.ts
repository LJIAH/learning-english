import { create } from "zustand";
import { logout as logoutApi } from "@/apis/user";
import { router } from "@/router";
import { toast } from "@/stores/toast";
import { useUserStore } from "@/stores/user";

interface LoginState {
  isShowLogin: boolean;
  openLogin: () => Promise<void>;
  closeLogin: () => void;
  logout: () => void;
}

/** 当前等待中的登录流程（模块级，与 Vue 版 useLogin.ts 的实现对齐） */
let pendingResolve: (() => void) | null = null;
let pendingReject: (() => void) | null = null;
let pendingPromise: Promise<void> | null = null;

/** 清理 pending 状态，不触发任何回调 */
const clearPending = () => {
  pendingResolve = null;
  pendingReject = null;
  pendingPromise = null;
};

/**
 * Esc 关闭弹窗的全局监听 —— 对应 Vue 版 useLogin 里 watch(isShowLogin) 的
 * add/removeEventListener。
 *
 * 必须注册在状态层（打开弹窗时同步挂上），不能放在 Login 组件里：弹窗是
 * 懒加载 + 条件挂载，组件内的 effect 要等 chunk 加载完、且被动 effect 真正
 * 执行后才注册 ——「弹窗已渲染可见、但监听还没就绪」的窗口里按 Esc 会丢失
 * （e2e 实测约 1/3 概率复现）。状态层注册发生在弹窗渲染之前，与 Vue 版
 * watch(pre-flush) 的时机一致。
 *
 * addEventListener/removeEventListener 对同一函数引用是幂等的，重复开关安全。
 */
const onEscape = (e: KeyboardEvent) => {
  if (e.key === "Escape") useLogin.getState().closeLogin();
};

/**
 * 登录弹窗控制 —— 对应 Vue 版 hooks/useLogin.ts。
 *
 * Promise 语义（首页「立即学习」依赖它：登录成功才跳转，取消则不跳）：
 *   - 已登录       → 立即 resolve
 *   - 未登录       → 挂起，登录成功 resolve、用户取消（Esc / 点遮罩）reject
 *
 * Vue 版把「关闭时 reject」放在 watch(isShowLogin) 里；React 没有 watch，
 * 这段逻辑直接写进 closeLogin（关闭时统一判定：已登录 resolve，否则 reject）。
 */
export const useLogin = create<LoginState>()((set) => ({
  isShowLogin: false,

  openLogin: () => {
    if (useUserStore.getState().user) return Promise.resolve();
    set({ isShowLogin: true });
    // 先于弹窗渲染注册 Esc 监听，消除「可见但不可关」的竞态窗口
    window.addEventListener("keydown", onEscape);
    // 已经在等待中的登录流程（例如弹窗 chunk 仍在加载时用户又点了一次）：
    // 复用同一个 Promise。否则 pendingResolve 会被覆盖，
    // 先前调用方的 await 将永远不会返回
    if (pendingPromise) return pendingPromise;
    pendingPromise = new Promise<void>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });
    return pendingPromise;
  },

  closeLogin: () => {
    window.removeEventListener("keydown", onEscape);
    if (useUserStore.getState().user && pendingResolve) {
      pendingResolve();
      clearPending();
    } else if (pendingReject) {
      // 未登录就关闭 → 视为用户取消
      pendingReject();
      clearPending();
    }
    set({ isShowLogin: false });
  },

  logout: () => {
    if (!window.confirm("确定要退出登录吗？")) return;
    void (async () => {
      // 通知后端吊销 token 并清除 cookie（best-effort，失败也清除本地状态）
      try {
        await logoutApi();
      } catch {
        // 忽略：即使后端登出失败也清除本地状态
      }
      useUserStore.getState().logout();
      toast.success("已退出登录");
      void router.navigate("/");
    })();
  },
}));
