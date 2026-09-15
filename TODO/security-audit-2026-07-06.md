# 安全审计与修复计划（2026-07-06）

> 在双 Token 认证问题（见 `security-issues.md`）修复后，对全项目进行第二轮安全审计发现以下新漏洞。
> 本文件记录漏洞、修复计划与状态。

## 修复优先级

| 优先级 | 漏洞 | 状态 |
|--------|------|------|
| P1 | `.env` 是否泄露到 Git | ✅ 已确认未跟踪 |
| P2 | 缺少 Helmet 安全头 + CORS 过于宽松 | ✅ 已修复 |
| P3 | XSS：v-html 渲染未净化的 Markdown/内容 | ✅ 已修复 |
| P4 | 后端缺少全局 ValidationPipe 输入验证 | ✅ 已修复 |
| P5 | register/refresh-token/upload-avatar 缺少限流与认证 | ✅ 已修复 |

---

## P1：`.env` 密钥泄露检查

- **检查方式**：`git ls-files | grep -i "\.env"` 返回空
- **结论**：`.env` 已在 `.gitignore` 中（根目录与 `server/` 均有规则），且未被 Git 跟踪。**无需改动**。
- **建议**：若历史提交中曾包含 `.env`，需用 `git log --all --full-history -- server/.env` 核查并轮换密钥。

---

## P2：缺少 Helmet + CORS 过于宽松

### 2.1 缺少 Helmet 安全头
- **文件**：`server/apps/server/src/main.ts`
- **问题**：未安装/启用 `helmet`，缺失 CSP、X-Frame-Options、X-Content-Type-Options 等安全响应头
- **修复**：安装 `helmet`，在 `main.ts` 中 `app.use(helmet())`

### 2.2 CORS `origin: true` 允许任意来源
- **文件**：`server/apps/server/src/main.ts`
- **问题**：`origin: true` + `credentials: true` 使任意网站可发起带 cookie 的跨域请求
- **修复**：改为环境变量 `CORS_ORIGIN` 配置的白名单，默认放行本地开发端口

### 2.3 Socket.IO CORS `origin: "*"`
- **文件**：`server/apps/server/src/socket/socket.gateway.ts`
- **问题**：允许任意来源连接 WebSocket
- **修复**：改为白名单

---

## P3：XSS — v-html 渲染未净化内容

- **文件**：
  - `apps/web/src/views/Chat/components/Bubble.vue`（AI 返回的 Markdown，`marked.parse` 后直接 `v-html`，**风险最高**）
  - `apps/web/src/views/WordBook/index.vue`（`v-html="item.translation"`）
  - `apps/web/src/views/Course/Learn/index.vue`（`v-html="currentWord?.definition"` / `translation`）
  - `apps/web/src/components/Search/index.vue`（`v-html="item.translation"`）
- **修复**：安装 `dompurify`，新建净化工具，对所有 `v-html` 输入做净化

---

## P4：后端缺少输入验证

- **文件**：`server/apps/server/src/main.ts`、`server/apps/server/src/user/user.controller.ts`
- **问题**：无全局 `ValidationPipe`，DTO 为 TypeScript `type`（无 class-validator 装饰器），可绕过前端传入任意数据
- **修复**：
  1. 安装 `class-validator`、`class-transformer`
  2. 在 server user 模块新建 class 形式 DTO（带验证装饰器）
  3. `main.ts` 启用 `useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`
  4. controller 改用 class DTO

---

## P5：限流与认证缺失

### 5.1 注册接口无限流
- **文件**：`server/apps/server/src/user/user.controller.ts`
- **修复**：`@Throttle({ default: { limit: 5, ttl: 60_000 } })`

### 5.2 刷新 token 接口无限流
- **修复**：加 `@Throttle`

### 5.3 上传头像无认证
- **修复**：加 `@UseGuards(AuthGuard)`，并对上传文件做类型校验

---

## 不在本次修复范围（需运维/产品介入）

- **accessToken 仍存 localStorage**：改为内存或 httpOnly cookie 涉及前端架构调整，风险较高，单独排期
- **生产环境密钥轮换**：若 `.env` 曾泄露到历史提交，需轮换 JWT/DB/MinIO/支付宝/邮箱/DeepSeek 等所有密钥
