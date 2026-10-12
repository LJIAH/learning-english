import { lazy, Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import Toaster from "@/components/Toaster";
import { socketClient } from "@/apis/socket";
import { useLogin } from "@/hooks/useLogin";
import { useUserStore } from "@/stores/user";
import { router } from "./router";

/**
 * 登录/注册弹窗：懒加载 + 条件挂载，对应 Vue 版 App.vue 的
 * defineAsyncComponent({ loader: loadLogin })，理由相同 ——
 * 弹窗内含表单校验与上传逻辑（较重），不进首屏包。
 */
const Login = lazy(() => import("@/components/Login"));

/**
 * 预取懒加载页面（Setting、Chat、WordBook）与登录弹窗。
 *
 * 关键点：这里与 router / Login 里用的是**同一个 import 说明符**，
 * Vite 解析为同一个模块、产出同一个 chunk —— 所以预取的就是用户
 * 点进去要用的那份代码，而不是另一份重复产物。
 *
 * 弹窗预取能消除 Vue 版注释里提到的「点一下没反应、要点两次」体感。
 */
const prefetchLazyRoutes = () => {
  void import("@/views/Setting");
  void import("@/views/Chat");
  void import("@/views/WordBook");
  void import("@/components/Login");
};

const requestIdle = (cb: () => void) => {
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number },
    ) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout: 2000 });
  } else {
    setTimeout(cb, 1000);
  }
};

export default function App() {
  const isShowLogin = useLogin((s) => s.isShowLogin);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    const run = () => requestIdle(prefetchLazyRoutes);

    // 等首屏关键资源加载完再预取，避免与首屏抢带宽
    if (document.readyState === "complete") {
      run();
      return;
    }
    window.addEventListener("load", run, { once: true });
    return () => window.removeEventListener("load", run);
  }, []);

  /**
   * socket 连接跟随登录态 —— 对应 Vue 版 App.vue 里
   * `watch(() => userStore.user?.id)` 的同一套逻辑。
   *
   * 登录后 connect、登出时 disconnect；后端按 query.userId 把连接
   * join 进 user_<id> 房间，支付成功等推送才有入口。
   * socket.io-client 是在 socketClient.connect() 内部**动态 import**的，
   * 所以它不会进首屏包，只在这个 effect 首次触发时才下载。
   */
  useEffect(() => {
    let disposed = false;
    void (async () => {
      if (disposed) return;
      if (user?.id) await socketClient.connect();
      else socketClient.disconnect();
    })();
    return () => {
      disposed = true;
    };
  }, [user?.id]);

  return (
    <>
      <RouterProvider router={router} />
      {isShowLogin && (
        <Suspense fallback={null}>
          <Login />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}
