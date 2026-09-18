<template>
  <header
    class="flex items-center h-20 border-b border-gray-200 justify-center sticky top-0 bg-white z-10"
  >
    <div
      class="max-w-300 w-full mx-auto px-6 flex items-center justify-between gap-4 overflow-x-auto"
    >
      <div
        class="text-2xl font-bold bg-indigo-700 text-white rounded-[10px] px-2 py-1 w-10 flex items-center justify-center h-10"
      >
        E
      </div>
      <div class="text-2xl font-bold">English App</div>
      <div
        v-for="nav in navItems"
        :key="nav.path"
        @click="handleNav(nav)"
        class="flex items-center gap-2 cursor-pointer rounded-[10px] px-3 py-2 shrink-0 transition-colors duration-200"
        :class="
          isActive(nav.path)
            ? 'text-indigo-600 bg-indigo-50'
            : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50'
        "
      >
        <el-icon>
          <component :is="nav.icon" />
        </el-icon>
        <span>{{ nav.label }}</span>
      </div>
      <div
        class="flex items-center gap-2 bg-blue-200 text-blue-700 rounded-full px-2 py-1 shrink-0"
      >
        <el-icon>
          <Sunny />
        </el-icon>
        <span class="font-bold text-sm">{{
          userStore.getUser?.wordNumber
        }}</span>
      </div>
      <div
        class="flex items-center gap-2 bg-amber-200 text-amber-700 rounded-full px-2 py-1 shrink-0"
      >
        <el-icon>
          <Star />
        </el-icon>
        <span class="font-bold text-sm">{{
          userStore.getUser?.dayNumber
        }}</span>
      </div>
      <el-popover :width="340">
        <template #reference>
          <div
            class="flex items-center gap-2 border-l cursor-pointer border-gray-200 pl-4 shrink-0"
          >
            <img
              class="w-10 h-10 rounded-full ml-2 mr-2"
              :src="avatar"
              width="40"
              height="40"
              decoding="async"
            />
            <span class="text-sm font-bold">{{
              userStore.getUser?.name ?? "游客"
            }}</span>
          </div>
        </template>
        <Profile />
      </el-popover>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useAvatar } from "@/hooks/useAvatar";
import Profile from "@/layout/Profile/index.vue";
import {
  Sunny,
  Star,
  HomeFilled,
  Notebook,
  MagicStick,
  Reading,
  Setting,
} from "@element-plus/icons-vue";
import { useRouter, useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";
import { ElMessage } from "element-plus";
import { useLogin } from "@/hooks/useLogin";
const userStore = useUserStore();
const router = useRouter();
const route = useRoute();
const { avatar } = useAvatar();
const { openLogin } = useLogin();

type NavItem = {
  path: string;
  label: string;
  icon: any;
  requiresAuth?: boolean;
};

const navItems: NavItem[] = [
  { path: "/", label: "主页", icon: HomeFilled },
  { path: "/chat", label: "AI", icon: MagicStick, requiresAuth: true },
  { path: "/word-book", label: "词库", icon: Notebook },
  { path: "/courses", label: "课程", icon: Reading },
  { path: "/setting", label: "设置", icon: Setting, requiresAuth: true },
];

const isActive = (path: string) => {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
};
const handleNav = async (nav: NavItem) => {
  if (nav.requiresAuth) {
    try {
      await openLogin();
      router.push(nav.path);
    } catch (error) {
      ElMessage.error("请先登录---");
    }
    return;
  }
  router.push(nav.path);
};
</script>
