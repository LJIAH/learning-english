import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (type: ToastType, message: string, duration?: number) => void;
  remove: (id: number) => void;
}

/**
 * 极简 toast —— 对应 Vue 版的 ElMessage（Element Plus）。
 *
 * 为什么不直接引 Element Plus / Ant Design 的消息组件：
 *   两者都会把整套 message 运行时（含 cssinjs / 动画 / 主题）带进首屏包，
 *   而这里只需要「一条带图标的提示 + 自动消失」，手写约 40 行足够。
 *   Ant Design 的 message 还依赖 React 上下文（App.useApp），
 *   在 axios 拦截器这种非组件环境里用不了。
 *
 * 非组件环境（如 axios 拦截器）通过下面导出的 toast 对象调用。
 */
let seed = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (type, message, duration = 2500) => {
    const id = ++seed;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 命令式调用入口，可在任意模块（含非组件代码）使用 */
export const toast = {
  success: (message: string) =>
    useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};
