import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { Token, UserUpdate, WebResultUser } from "@en/common/user";

export const useUserStore = defineStore(
  "user",
  () => {
    const user = ref<WebResultUser | null>(null);
    const setUser = (u: WebResultUser | null) => {
      user.value = u;
    };
    const getUser = computed(() => user.value);
    const logout = () => {
      user.value = null;
    };
    const getAccessToken = computed(() => user.value?.token?.accessToken);
    const getRefreshToken = computed(() => user.value?.token?.refreshToken);
    const updateToken = (newToken: Token) => {
      user.value = { ...user.value, token: newToken } as WebResultUser;
    };
    // 更新用户单词数量
    const updateUserWordNumber = (newWordNumber: number) => {
      user.value!.wordNumber = newWordNumber;
    };
    // 更新用户信息
    const updateUser = (newInfo: UserUpdate) => {
      user.value!.name = newInfo.name;
      user.value!.email = newInfo.email;
      user.value!.address = newInfo.address;
      user.value!.avatar = newInfo.avatar;
      user.value!.bio = newInfo.bio;
      user.value!.isTimingTask = newInfo.isTimingTask;
      user.value!.timingTaskTime = newInfo.timingTaskTime;
    };
    // 在设置界面默认获取的用户信息
    const getUpdateUserInfo = computed<UserUpdate>(() => {
      return {
        name: user.value!.name,
        email: user.value!.email,
        address: user.value!.address,
        avatar: user.value!.avatar,
        bio: user.value!.bio,
        isTimingTask: user.value!.isTimingTask,
        timingTaskTime: user.value!.timingTaskTime,
      };
    });
    return {
      user,
      getUser,
      setUser,
      logout,
      getAccessToken,
      getRefreshToken,
      updateToken,
      updateUser,
      getUpdateUserInfo,
      updateUserWordNumber,
    };
  },
  { persist: { pick: ["user"] } },
);
