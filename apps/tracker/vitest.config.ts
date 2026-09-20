import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// 单测只覆盖源码逻辑，不涉及构建产物：这里单独配置，
// 避免加载 vite.config.ts 里的 vite-plugin-dts / lib 构建配置
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // 埋点 SDK 依赖 window / document / navigator / history，需要浏览器环境
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        // 用例会断言上报内容里的页面地址 / 路径，需要一个确定的 location
        url: "https://en.example.com/",
      },
    },
    include: ["index.spec.ts", "src/**/*.spec.ts"],
    clearMocks: true,
    // jsdom 环境创建是主要开销，vmThreads 让每个 worker 复用同一份环境（仍保持按文件隔离）
    pool: "vmThreads",
  },
});
