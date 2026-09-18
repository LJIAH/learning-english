import { fileURLToPath, URL } from "node:url";
import { Config } from "@en/config";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: Config.ports.web,
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
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    // Element Plus 按需引入：模板里用到的 el-* 组件及其样式在此自动注入，
    // 取代原先 main.ts 中 app.use(ElementPlus) + 全量 index.css 的方式
    Components({
      resolvers: [ElementPlusResolver()],
      dts: "src/types/components.d.ts",
    }),
    // 服务式 API（ElMessage / ElMessageBox 等）的自动导入兜底（含样式），
    // 已显式 import 的文件不受影响
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: "src/types/auto-imports.d.ts",
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // 首屏主包体积预算：按需引入后应明显低于此阈值，超过即告警（不再人为调高掩盖）
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: true, // 开启智能分包
      },
    },
  },
});
