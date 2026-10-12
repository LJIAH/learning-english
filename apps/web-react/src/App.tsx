import { lazy, Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import type { Tracker as TrackerInstance } from "@en/tracker";
import Toaster from "@/components/Toaster";
import { socketClient } from "@/apis/socket";
import { useLogin } from "@/hooks/useLogin";
import { useSearch } from "@/hooks/useSearch";
import { useUserStore } from "@/stores/user";
import { router } from "./router";

/**
 * 登录/注册弹窗：懒加载 + 条件挂载，对应 Vue 版 App.vue 的
 * defineAsyncComponent({ loader: loadLogin })，理由相同 ——
 * 弹窗内含表单校验与上传逻辑（较重），不进首屏包。
 */
const Login = lazy(() => import("@/components/Login"));

/**
 * 全局搜索弹窗：同样懒加载 + 条件挂载（对应 Vue 版的 `<Search v-if="isShowSearch" />`）。
 * 它依赖 axios 与词库接口，不进首屏包；快捷键在 hooks/useSearch 里注册，
 * 组件挂载与否不影响按 Ctrl + F 唤起。
 */
const Search = lazy(() => import("@/components/Search"));

/**
 * 预取懒加载页面（Setting、Chat、WordBook）与登录弹窗、搜索弹窗。
 *
 * 关键点：这里与 router / Login / Search 里用的是**同一个 import 说明符**，
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
  void import("@/components/Search");
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

/**
 * 埋点实例与初始化守卫 —— 都放模块级。
 *
 * 埋点本身就是全局单例，放组件里会踩 React 开发期 StrictMode 的「挂载 → 卸载 →
 * 再挂载」：effect 执行两次 → 初始化两个 Tracker 实例 → **uv / pv 各上报两遍**
 * （实测确认）。用模块级守卫挡住，实例也放模块级，避免第二次挂载拿不到实例。
 * 生产构建没有双挂载，但这样写两边都稳。
 */
let tracker: TrackerInstance | null = null;
let trackerInitStarted = false;

/**
 * 埋点 SDK 初始化 —— 对应 Vue 版 App.vue 的 initTracker。
 *
 * 整包（含 fingerprintjs 指纹采集、ua-parser、web-vitals）延迟到浏览器空闲时
 * 再动态加载并初始化：只是把这段开销从首屏渲染路径上挪开，
 * UV / PV / 事件 / 错误 / Web Vitals 的上报能力不变。
 *
 * 用的是 同一个 import 说明符 `@en/tracker`，Vite 会把它打成独立 chunk
 * （实测 gzip 28.7 kB），不进首屏包。
 */
const initTracker = async () => {
  if (trackerInitStarted) return;
  trackerInitStarted = true;
  const { Tracker } = await import("@en/tracker");
  tracker = new Tracker({
    baseUrl: "/api/v1",
    uv: {
      api: "/tracker/uv",
      updateApi: "/tracker/update-uv",
    },
    pv: {
      api: "/tracker/pv",
    },
    event: {
      api: "/tracker/event",
    },
    error: {
      api: "/tracker/error",
    },
    performance: {
      api: "/tracker/performance",
    },
  });
  // 初始化完成时如果用户已登录，补一次用户绑定（UV → userId）
  const userId = useUserStore.getState().user?.id;
  if (userId) tracker.setUserId(userId);
};

export default function App() {
  const isShowLogin = useLogin((s) => s.isShowLogin);
  const isShowSearch = useSearch((s) => s.isShowSearch);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    const run = () => {
      requestIdle(prefetchLazyRoutes);
      requestIdle(() => void initTracker());
    };

    // 等首屏关键资源加载完再预取/初始化，避免与首屏抢带宽
    if (document.readyState === "complete") {
      run();
      return;
    }
    window.addEventListener("load", run, { once: true });
    return () => window.removeEventListener("load", run);
  }, []);

  /**
   * 登录态变化 —— 对应 Vue 版 App.vue 里 `watch(() => userStore.user?.id)`：
   * 绑定埋点用户 + 建立/断开 socket 连接。
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
      if (user?.id) {
        tracker?.setUserId(user.id);
        await socketClient.connect();
      } else {
        socketClient.disconnect();
      }
    })();
    return () => {
      disposed = true;
    };
  }, [user?.id]);

  return (
    <>
      <RouterProvider router={router} />
      {isShowSearch && (
        <Suspense fallback={null}>
          <Search />
        </Suspense>
      )}
      {isShowLogin && (
        <Suspense fallback={null}>
          <Login />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}
