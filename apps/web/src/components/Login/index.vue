<template>
  <Transition name="backdrop">
    <div
      v-if="isShowLogin"
      @click.self="closeLogin"
      class="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
    ></div>
  </Transition>
  <Transition name="modal">
    <div
      v-if="isShowLogin"
      class="fixed inset-30 flex items-center justify-center z-50"
    >
      <div
        class="relative w-250 h-160 bg-white rounded-2xl shadow-2xl overflow-hidden flex"
      >
        <!-- 关闭按钮 -->
        <button
          class="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200 cursor-pointer"
          aria-label="关闭"
          @click="closeLogin"
        >
          <Close class="w-4 h-4" />
        </button>

        <!-- 左侧 3D 模型区域 -->
        <ModelViewer ref="modelViewerRef" @changeType="changeType" />

        <!-- 右侧登录表单区域 -->
        <div
          class="flex-1 flex flex-col justify-center px-8 py-10 bg-white min-w-64"
        >
          <LoginForm v-if="loginType === 'login'" />
          <RegisterForm v-else />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Close } from "@element-plus/icons-vue";
import ModelViewer, { type LoginType } from "./ModelViewer.vue";
import LoginForm from "./LoginForm.vue";
import RegisterForm from "./RegisterForm.vue";
import { useLogin } from "../../hooks/useLogin.ts";
import { onMounted, ref } from "vue";
const { isShowLogin, closeLogin } = useLogin();
const loginType = ref<LoginType>("login");
const changeType = (type: string) => {
  // console.log(type);
  loginType.value = type as LoginType;
};
onMounted(() => {
  changeType("login");
});
</script>

<style scoped>
/* 遮罩层动画 */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* 弹窗卡片动画 */
.modal-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.modal-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.modal-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.modal-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
