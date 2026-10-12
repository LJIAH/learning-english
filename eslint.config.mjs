// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * Monorepo 根级 ESLint（flat config）。
 *
 * 分工说明：
 *   - 本文件覆盖 apps/*（Vue / React / tracker 库）与 packages/*
 *   - server/ 保留自己的 eslint.config.mjs —— 它启用了 type-checked 规则集
 *     （能抓未 await 的 Promise 等），这里显式 ignore，避免两套规则叠加
 *   - 类型正确性由各包的 type-check 脚本负责（tsc -b / vue-tsc / tsc --noEmit），
 *     ESLint 这边用非类型检查的 recommended，跑得快，两者不重复
 *   - prettier 必须放最后：关闭所有与 Prettier 冲突的格式化规则，
 *     避免 lint-staged 里 eslint --fix 与 prettier --write 互相拉扯
 */
export default defineConfig(
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "**/*.d.ts",
    "**/playwright-report/**",
    "**/test-results/**",
    "server/**",
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- 浏览器端（apps/* + packages/*，混合环境给 browser+node 防止误报 undefined）----
  {
    files: ["**/*.{ts,tsx,vue}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // ---- Node 脚本（scripts/*.mjs、deploy/*.js 等）----
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["deploy/**"],
    rules: { "@typescript-eslint/no-require-imports": "off" }, // PM2 等 CJS 配置合法使用 require
  },

  // ---- Vue（apps/web）----
  ...pluginVue.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["apps/web/**/*.vue"],
  })),
  {
    files: ["apps/web/**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // ---- React（apps/web-react）----
  {
    files: ["apps/web-react/**/*.{ts,tsx}"],
    // 类型断言：eslint-plugin-react-hooks 仍按旧版 Rule.RuleModule 声明规则，
    // 与 ESLint 核心（@eslint/core）的 Plugin 类型尚未对齐；运行时行为不变
    plugins: { "react-hooks": /** @type {any} */ (reactHooks) },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 新版严格规则：useEffect 内直接 setState 需重构才能消除，
      // 现有 5 处按技术债处理，降为警告，不阻塞提交
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // ---- 通用放宽：与 server 侧保持一致的口径 ----
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // index.vue / Home.vue 等单词文件名是项目既有约定，重命名成本大于收益
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // 必须最后：关闭所有格式化规则，交给 Prettier
  prettier,
);
