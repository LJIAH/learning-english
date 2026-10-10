import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

/**
 * 预取懒加载页面（Setting、Chat）。
 *
 * 关键点：这里与 router 里 React.lazy 用的是**同一个 import 说明符**，
 * Vite 解析为同一个模块、产出同一个 chunk —— 所以预取的就是用户
 * 点进去要用的那份代码，而不是另一份重复产物。
 */
const prefetchLazyRoutes = () => {
  void import("@/views/Setting");
  void import("@/views/Chat");
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

  return <RouterProvider router={router} />;
}
