import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@en/common/user";

export type { User };

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
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
 */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // 展示用 mock 用户：让页面有数据可渲染。
      // 接入真实登录后应改为 null，由登录流程写入。
      user: {
        id: "1",
        name: "林佳辉",
        phone: "13800138000",
        password: "",
        email: "demo@example.com",
        address: "广州",
        bio: "每天进步一点点",
        avatar: "",
        isTimingTask: false,
        timingTaskTime: "",
        wordNumber: 1280,
        dayNumber: 5,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: "en-user" },
  ),
);
