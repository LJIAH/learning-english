import Header from "./Header";
import Content from "./Content";

/** 对应 Vue 版 layout/index.vue —— 结构一致：Header + Content */
export default function Layout() {
  return (
    <>
      <Header />
      <Content />
    </>
  );
}
