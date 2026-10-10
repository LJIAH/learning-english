import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "@/layout";
import Home from "@/views/Home";
import WordBook from "@/views/WordBook";

/**
 * 设置页懒加载。
 *
 * 它是全站唯一使用 Ant Design 的页面（表单校验手写等于重造轮子）。
 * AntD 约 126 kB gzip，隔离出去后不进首屏包；
 * 首屏空闲时再由 App.tsx 预取，用户点进来时 chunk 已在缓存里。
 */
const Setting = lazy(() => import("@/views/Setting"));

/** 尚未迁移的页面占位，保证导航可用、不白屏 */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="max-w-300 mx-auto mt-10 px-6 text-center text-gray-400">
      {title} · 待实现
    </div>
  );
}

/**
 * 路由 —— 对应 Vue 版的 router/index.ts。
 *
 * Vue 版是「一个 layout 父路由 + 5 个子路由」的扁平结构，
 * React 侧用同样的形状（element 替代 component、index 替代 path: ""）。
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "word-book", element: <WordBook /> },
      {
        path: "setting",
        element: (
          <Suspense fallback={null}>
            <Setting />
          </Suspense>
        ),
      },
      { path: "chat", element: <Placeholder title="AI 对话" /> },
      { path: "courses", element: <Placeholder title="课程" /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
