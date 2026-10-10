import { useUserStore } from "@/stores/user";
import defaultAvatar from "@/assets/images/avatar/default-avatar.webp";

/**
 * 头像 —— 对应 Vue 版的 hooks/useAvatar.ts。
 * 未登录 / 用户未设置头像时回落到默认头像。
 */
export function useAvatar() {
  const avatar = useUserStore((s) => s.user?.avatar);
  return { avatar: avatar ?? defaultAvatar };
}
