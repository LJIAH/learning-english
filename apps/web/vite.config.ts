import { fileURLToPath, URL } from "node:url";
import { Config } from "@en/config";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";

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
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
