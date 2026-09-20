# @en/tracker

前端埋点 SDK：UV（访客）/ PV / 自定义事件 / 错误 / 性能（Web Vitals）上报。

- 构建产物在 `dist/`（`vite build`，含 d.ts），由 `apps/web` 以 workspace 依赖消费；
- 设计原则：上报是**旁路能力**——任何失败都静默降级，绝不向宿主页面抛异常；
- 使用示例见 `index.ts` 底部注释。

## 单元测试

Vitest + jsdom：jsdom 未实现的 `navigator.sendBeacon`、`PerformanceObserver` 由用例注入可控替身。

```bash
pnpm --filter @en/tracker test        # 单次运行
pnpm --filter @en/tracker test:watch  # 监听模式
pnpm test:unit                        # 仓库根目录等价写法
```

- 用例与源码同目录（`src/<模块>/index.spec.ts`，入口类为 `index.spec.ts`）；
- `vitest.config.ts` 单独配置（不加载 `vite.config.ts` 的 dts / lib 构建插件），复用 `@` 别名，并把 `location` 固定为 `https://en.example.com/`；
- 外部依赖（`@fingerprintjs/fingerprintjs`、`ua-parser-js`）与兄弟模块（`@/report` 等）一律 mock，只测本模块逻辑；
- 事件 / 路由 / 性能监听挂在 `document`、`window` 上且不随用例卸载，各用例用独立 `visitorId` 区分自己产生的上报。

## 变更记录

### 2026-09-19 · 新增：Vitest 单元测试（8 个文件 / 35 例）

- 依赖 `vitest@^5.0.1`（Vite 8 需 Vitest ≥ 4.1）与 `jsdom`，脚本 `test`（单次）/ `test:watch`（监听）；
- 覆盖 `config` / `report` / `event` / `error` / `pv` / `uv` / `performance` 与 `Tracker` 入口类；
- 重点用例：`reportFetch` 在 502、请求失败、空响应体下静默返回 `null`（对应下一节的修复）；PV 的 hash 上报与 popstate 去重；`Tracker.readyPromise` 在指纹失败时不 reject、`setUserId` 的「就绪前排队 / 就绪后立即」两条路径；
- 性能：jsdom 环境创建是主要开销，`pool: "vmThreads"` 后单次运行由 41s 降至 6.5s；
- 用例保留在 `tsconfig.json` 的 `include` 里（`@` 别名与源码共用同一份 `paths`，IDE 才能解析），改由 `vite-plugin-dts` 的 `exclude` 挡住声明产物——`dist` 中不含任何 `*.spec.d.ts`。

### 2026-09-19 · 修复：上报接口异常时的未捕获异常（由 E2E 用例发现）

- **现象**：后端不可用（网关 502、空响应体）时，`reportFetch` 解析 `response.json()` 抛 `SyntaxError`；`Tracker.init()` 的 `readyPromise` 无 catch，页面层面出现未处理 Promise 拒绝。
- **修复**：
  - `src/report/index.ts`：`reportFetch` 整体 `try/catch` + `response.ok` 判断，失败静默返回 `null`；
  - `src/uv/index.ts`：调用方 `res?.data` 判空；
  - `index.ts`：`init()` 加 `try/catch`、无 `visitorId` 时跳过依赖它的上报 → `readyPromise` 永不 reject。
- **验证**：重建 `dist` 后重跑 E2E，4 条用例全绿（含 `apps/web/e2e/login-gate.spec.ts` 的「无未处理 Promise 拒绝」守卫断言）。
- **完整记录**：`docs/performance/report-2026-09-18.md` 第七节第 3 条（该文档在本地 `docs/`，不入库）。
