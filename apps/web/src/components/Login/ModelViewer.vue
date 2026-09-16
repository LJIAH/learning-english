<template>
  <div
    class="relative w-135 shrink-0 h-full overflow-hidden bg-linear-to-br from-gray-800 to-gray-900"
  >
    <!-- 外教形象（登录/注册切换），铺满左栏 -->
    <Transition name="fade" mode="out-in">
      <img
        :key="type"
        :src="IMAGES[type]"
        alt="AI 英语外教"
        draggable="false"
        class="absolute inset-0 w-full h-full object-cover object-top"
      />
    </Transition>
    <div class="absolute top-6 left-6">
      <div class="flex items-center gap-2">
        <div
          class="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-[10px] flex items-center justify-center"
        >
          <span class="text-white font-bold text-xl">E</span>
        </div>
        <span class="text-white text-xl font-bold">English App</span>
      </div>
    </div>
    <!-- 登录/注册切换按钮 -->
    <div class="absolute top-6 right-6">
      <div
        class="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-1"
      >
        <button :class="loginClass" @click="switchModel('login')">登录</button>
        <button :class="registerClass" @click="switchModel('register')">
          注册
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const IMAGES = {
  login: "/images/teacher-login.png",
  register: "/images/teacher-register.png",
} as const;

export type LoginType = keyof typeof IMAGES;

const type = ref<LoginType>("login");
const loginClass = computed(() =>
  type.value === "login"
    ? "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all"
    : "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
);
const registerClass = computed(() =>
  type.value === "register"
    ? "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all"
    : "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
);

const emits = defineEmits(["changeType"]);

const switchModel = (key: LoginType) => {
  emits("changeType", key);
  type.value = key;
};
</script>

<style scoped>
/* 登录/注册图片切换过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
