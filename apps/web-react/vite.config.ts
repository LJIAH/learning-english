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
