import { App as AntApp, ConfigProvider } from "antd";
import type { ReactNode } from "react";

/**
 * Ant Design 容器 —— 把 AntD 默认设计语言收敛到 Element Plus 的视觉参数
 * （主色 #409eff、圆角 4），缩小两版前端的观感差异。
 *
 * ⚠️ 只允许被「懒加载页面」引用（Setting / WordBook）。
 * 一旦被首屏模块（App / Layout / Home …）引用，antd 会被拖进首屏包
 * —— 实测代价 +100 kB gzip（312 → 412 kB）。首屏体积以 vite build 的
 * index chunk 为准，改完务必核对。
 */
export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: "#409eff", borderRadius: 4 } }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
