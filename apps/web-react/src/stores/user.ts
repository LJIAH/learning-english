import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserUpdate, WebResultUser } from "@en/common/user";

export type { WebResultUser };

interface UserState {
  user: WebResultUser | null;
  setUser: (user: WebResultUser | null) => void;
  logout: () => void;
  /** 供 axios 请求拦截器使用（非组件环境，须用 getState() 调用） */
  getAccessToken: () => string | undefined;
  /** 401 刷新成功后更新 accessToken */
  updateAccessToken: (accessToken: string) => void;
  /** 更新用户信息（与 Vue 版 store 的 updateUser 逐字段对齐） */
  updateUser: (info: UserUpdate) => void;
  /** 学习完成后更新单词数量 */
  updateUserWordNumber: (wordNumber: number) => void;
}

/**
 * 用户状态 —— 对应 Vue 版的 stores/user.ts（Pinia）。
 *
 * 用法差异：
 *   Vue   : const userStore = useUserStore(); userStore.getUser?.name
 *   React : const user = useUserStore((s) => s.user); user?.name
 *
 * 注意：React 侧必须用「选择器」取字段。直接 useUserStore() 会让组件在
 * 任意字段变化时都重渲染，是 Zustand 最常见的性能坑。
 *
 * 用户数据来自登录接口（WebResultUser），refreshToken 存 httpOnly cookie，
 * 前端只持有短期 accessToken —— 与 Vue 版一致。
 */
export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
      getAccessToken: () => get().user?.accessToken,
      updateAccessToken: (accessToken) => {
        const user = get().user;
        if (user) set({ user: { ...user, accessToken } });
      },
      updateUser: (info) => {
        const user = get().user;
        if (!user) return;
        set({
          user: {
            ...user,
            ...info,
            // UserUpdate.timingTaskTime 选填（关闭定时任务时为 undefined），
            // 用户实体要求 string，用空串兜底
            timingTaskTime: info.timingTaskTime ?? "",
          },
        });
      },
      updateUserWordNumber: (wordNumber) => {
        const user = get().user;
        if (user) set({ user: { ...user, wordNumber } });
      },
    }),
    {
      name: "en-user",
      // 只持久化 user；函数不参与序列化
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
