import { Outlet } from "react-router-dom";

/** 对应 Vue 版 layout/Content/index.vue —— 唯一的职责是渲染子路由 */
export default function Content() {
  return <Outlet />;
}
