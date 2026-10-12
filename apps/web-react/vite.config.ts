import { fileURLToPath, URL } from "node:url";
import { Config } from "@en/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    // 与 Vue 版（Config.ports.web = 8080）错开，两个前端可同时启动
    port: Config.ports.web + 1,
    proxy: {
      "/api": {
        target: `http://localhost:${Config.ports.server}`,
        changeOrigin: true,
      },
      "/ai": {
        target: `http://localhost:${Config.ports.ai}`,
        changeOrigin: true,
      },
      /**
       * socket.io 走同源代理，而不是像 Vue 版那样直连 3000。
       *
       * 原因：直连是跨源请求，握手要过服务端的 CORS 白名单（server/.env 的
       * CORS_ORIGIN），dev 端口一改就得同步改后端并重启 —— 一次配置错就静默连不上。
       * 走代理后前端只连自己的 origin，**不存在 CORS**；
       * 且与生产拓扑一致（nginx 本就把 /socket.io/ 反代到 3000）。
       *
       * ws: true 必须显式打开 —— 客户端 transports 只开了 websocket，
       * 需要把 Upgrade 请求一并代理过去。
       */
      "/socket.io": {
        target: `http://localhost:${Config.ports.server}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // 与 Vue 版同一预算标准：首屏主包超过即告警
    chunkSizeWarningLimit: 500,
  },
});
