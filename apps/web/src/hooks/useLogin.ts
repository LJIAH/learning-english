import { ref, watch } from "vue";
import { useUserStore } from "@/stores/user";
import { ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { logout as logoutApi } from "@/apis/user";

const isShowLogin = ref(false);
let pendingResolve: (() => void) | null = null;
let pendingReject: (() => void) | null = null;

// 清理 pending 状态，不触发任何回调
const clearPending = () => {
  pendingResolve = null;
  pendingReject = null;
};

const onEscape = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    isShowLogin.value = false;
  }
};

// ESC / 点击背景关闭弹窗，此时用户未登录，reject
watch(isShowLogin, (val) => {
  if (val) {
    window.addEventListener("keydown", onEscape);
  } else {
    window.removeEventListener("keydown", onEscape);
    if (pendingReject) {
      pendingReject();
      clearPending();
    }
  }
});

export const useLogin = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const openLogin = (): Promise<void> => {
    if (userStore.getUser) return Promise.resolve();
    isShowLogin.value = true;
    return new Promise<void>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });
  };

  // 关闭弹窗时自动判断：已登录则 resolve，未登录则由 watch(isShowLogin) reject
  const closeLogin = () => {
    if (userStore.getUser && pendingResolve) {
      pendingResolve();
      clearPending();
    }
    isShowLogin.value = false;
  };

  const logout = () => {
    ElMessageBox.confirm("确定要退出登录吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    }).then(async () => {
      // 通知后端吊销 token 并清除 cookie（best-effort，失败也清除本地状态）
      try {
        await logoutApi();
      } catch {
        // 忽略：即使后端登出失败也清除本地状态
      }
      userStore.logout();
      router.push("/");
    });
  };

  return { isShowLogin, openLogin, closeLogin, logout };
};
