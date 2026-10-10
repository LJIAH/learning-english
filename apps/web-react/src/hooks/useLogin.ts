import { create } from "zustand";
import { useUserStore } from "@/stores/user";

interface LoginState {
  isShowLogin: boolean;
  openLogin: () => Promise<void>;
  closeLogin: () => void;
  logout: () => void;
}

/**
 * 登录弹窗控制 —— 对应 Vue 版的 hooks/useLogin.ts。
 *
 * 与 Vue 版的差异（待接入真实接口后补齐）：
 *   Vue   : openLogin() 返回 Promise —— 已登录立即 resolve；
 *           未登录则挂起，登录成功 resolve、用户取消 reject（Esc / 点遮罩）
 *   React : 当前为占位实现，只负责开合弹窗，不做 Promise 挂起
 *
 * 首页「立即学习」依赖这个 Promise 语义：登录成功才跳 /chat，
 * 取消则不跳。接入真实登录时要把 reject 分支补回来。
 */
export const useLogin = create<LoginState>()((set) => ({
  isShowLogin: false,

  openLogin: async () => {
    const { user } = useUserStore.getState();
    if (user) return;
    set({ isShowLogin: true });
  },

  closeLogin: () => set({ isShowLogin: false }),

  logout: () => {
    useUserStore.getState().logout();
  },
}));
