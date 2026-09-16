import { uploadUrl } from "@/apis";
import defaultAvatar from "@/assets/images/avatar/default-avatar.webp";
import { useUserStore } from "@/stores/user";
import { computed } from "vue";

export const useAvatar = () => {
  const userStore = useUserStore();
  const avatar = computed(() => {
    if (userStore.getUser?.avatar) {
      return uploadUrl + userStore.getUser.avatar;
    }
    return defaultAvatar;
  });
  const customAvatar = (avatar: string) => {
    if (avatar) {
      return uploadUrl + avatar;
    } else {
      return defaultAvatar;
    }
  };
  return { avatar, customAvatar };
};
