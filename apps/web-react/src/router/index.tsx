import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "@/layout";
import Home from "@/views/Home";
import WordBook from "@/views/WordBook";
import Course from "@/views/Course";
import Learn from "@/views/Course/Learn";
/**
 * 两个重依赖页面做懒加载，避免拖累首屏：
 *   - Setting：全站唯一用 Ant Design 的页面（表单校验手写等于重造轮子）
 *   - Chat：额外引入 marked + dompurify（约 26 kB gzip）
 * 首屏空闲时再由 App.tsx 预取，用户点进来时 chunk 已在缓存里。
 */
const Setting = lazy(() => import("@/views/Setting"));
const Chat = lazy(() => import("@/views/Chat"));

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
      {
        path: "chat",
        element: (
          <Suspense fallback={null}>
            <Chat />
          </Suspense>
        ),
      },
      { path: "courses", element: <Course /> },
      { path: "courses/learn/:courseId/:title", element: <Learn /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
