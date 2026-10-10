import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, redirect } from "react-router-dom";
import Layout from "@/layout";
import Home from "@/views/Home";
import Course from "@/views/Course";
import Learn from "@/views/Course/Learn";
import { toast } from "@/stores/toast";
import { useUserStore } from "@/stores/user";
/**
 * 三个重依赖页面做懒加载，避免拖累首屏：
 *   - Setting：Ant Design 表单（校验手写等于重造轮子）
 *   - Chat：额外引入 marked + dompurify（约 26 kB gzip）
 *   - WordBook：改用 AntD Pagination 后也依赖 antd —— 不懒加载就会把
 *     整个 antd 拖进首屏（实测 312 → 412 kB gzip）。三者共享同一份 antd chunk。
 * 首屏空闲时再由 App.tsx 预取，用户点进来时 chunk 已在缓存里。
 */
const Setting = lazy(() => import("@/views/Setting"));
const Chat = lazy(() => import("@/views/Chat"));
const WordBook = lazy(() => import("@/views/WordBook"));

/**
 * 路由级登录守卫 —— 对应 Vue 版 router.beforeEach 里的 requiresAuth 判断。
 *
 * 为什么需要：Header 的点击守卫（layout/Header/index.tsx 的 handleNav）
 * 只挡「点导航」，挡不住**直接输 URL / 刷新**。游客直接进 /chat 时页面照常渲染，
 * 但 Chat 里 sendMessage 的 `if (!userId) return` 会把消息静默丢掉
 * —— 表现为「输入了、点了发送、什么也没发生」，看起来像接口没接上。
 *
 * 行为与 Vue 一致：提示「请先登录」并回首页。
 * （zustand persist 用 localStorage 同步 rehydrate，所以刷新后状态已就绪，
 * 不会把已登录用户误判为游客。）
 */
const requireAuth = () => {
  if (!useUserStore.getState().user) {
    toast.error("请先登录");
    return redirect("/");
  }
  return null;
};

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
      {
        path: "word-book",
        element: (
          <Suspense fallback={null}>
            <WordBook />
          </Suspense>
        ),
      },
      {
        path: "setting",
        loader: requireAuth,
        element: (
          <Suspense fallback={null}>
            <Setting />
          </Suspense>
        ),
      },
      {
        path: "chat",
        loader: requireAuth,
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
