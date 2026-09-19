# @en/tracker

前端埋点 SDK：UV（访客）/ PV / 自定义事件 / 错误 / 性能（Web Vitals）上报。

- 构建产物在 `dist/`（`vite build`，含 d.ts），由 `apps/web` 以 workspace 依赖消费；
- 设计原则：上报是**旁路能力**——任何失败都静默降级，绝不向宿主页面抛异常；
- 使用示例见 `index.ts` 底部注释。

## 变更记录

### 2026-09-19 · 修复：上报接口异常时的未捕获异常（由 E2E 用例发现）

- **现象**：后端不可用（网关 502、空响应体）时，`reportFetch` 解析 `response.json()` 抛 `SyntaxError`；`Tracker.init()` 的 `readyPromise` 无 catch，页面层面出现未处理 Promise 拒绝。
- **修复**：
  - `src/report/index.ts`：`reportFetch` 整体 `try/catch` + `response.ok` 判断，失败静默返回 `null`；
  - `src/uv/index.ts`：调用方 `res?.data` 判空；
  - `index.ts`：`init()` 加 `try/catch`、无 `visitorId` 时跳过依赖它的上报 → `readyPromise` 永不 reject。
- **验证**：重建 `dist` 后重跑 E2E，4 条用例全绿（含 `apps/web/e2e/login-gate.spec.ts` 的「无未处理 Promise 拒绝」守卫断言）。
- **完整记录**：`docs/performance/report-2026-09-18.md` 第七节第 3 条（该文档在本地 `docs/`，不入库）。
