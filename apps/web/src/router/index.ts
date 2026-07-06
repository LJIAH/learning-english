import { createRouter, createWebHistory } from "vue-router";
import layout from "@/layout/index.vue";
import home from "./home/index";
import wordBook from "./word-book/index";
import setting from "./setting";
import chat from "./chat/index";
import { useUserStore } from "@/stores/user";
import { ElMessage } from "element-plus";
import course from "./course";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: layout,
      children: [
        ...home, // 主页
        ...wordBook, // 词库
        ...setting, // 设置
        ...chat, // 聊天
        ...course,
      ],
    },
  ],
});
router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const userStore = useUserStore();
    if (!userStore.getUser) {
      ElMessage.error("请先登录");
      return { path: "/" };
    }
  }
});

export default router;
