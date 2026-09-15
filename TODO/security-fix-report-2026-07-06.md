# 安全修复报告（2026-07-06）

> 本报告记录第二轮安全审计发现的漏洞及其修复情况。审计与漏洞清单见同目录 `security-audit-2026-07-06.md`。
> 验证：`server` 与 `web` 两端均通过 `tsc --noEmit` / `vue-tsc --noEmit` 类型检查。

---

## 一、修复总览

| 优先级 | 漏洞 | 修复状态 |
|--------|------|----------|
| P1 | `.env` 泄露到 Git | ✅ 已确认未跟踪（`.gitignore` 规则已生效） |
| P2 | 缺少 Helmet 安全头 | ✅ 已安装并启用 `helmet` |
| P2 | CORS `origin: true` 过于宽松 | ✅ 改为环境变量白名单 |
| P2 | Socket.IO `origin: "*"` | ✅ 改为白名单 |
| P3 | AI Markdown 经 `v-html` 渲染（XSS） | ✅ `marked.parse` 输出经 DOMPurify 净化 |
| P3 | 单词翻译/释义经 `v-html` 渲染（XSS） | ✅ 改用 `v-safe-html` 指令自动净化 |
| P4 | 后端无全局输入验证 | ✅ 启用 `ValidationPipe` + class-validator DTO |
| P5 | 注册接口无限流 | ✅ 60s/5 次限流 |
| P5 | 刷新 token 接口无限流 | ✅ 60s/10 次限流 |
| P5 | 上传头像无认证 | ✅ 加 `AuthGuard` |
| P5 | 上传文件无类型校验 | ✌ 加图片类型 `fileFilter` + 5MB 限制 |

---

## 二、修复详情

### P2-1 启用 Helmet 安全头

**文件**：`server/apps/server/src/main.ts`

```ts
import helmet from "helmet";
// ...
app.use(helmet());
```

新增依赖：`helmet@^8.2.0`（server）。自动设置 CSP、X-Frame-Options、X-Content-Type-Options、Strict-Transport-Security 等安全响应头。

### P2-2 收紧 CORS 来源

**文件**：`server/apps/server/src/main.ts`

将 `origin: true` 改为基于环境变量 `CORS_ORIGIN`（逗号分隔）的白名单校验，未配置时默认放行本地开发端口（8080/5173）。生产环境通过设置 `CORS_ORIGIN=https://yourdomain.com` 限定。

### P2-3 收紧 Socket.IO CORS

**文件**：`server/apps/server/src/socket/socket.gateway.ts`

将 `origin: "*"` 改为同样的白名单逻辑，并启用 `credentials: true`。

### P3 修复 XSS（v-html 净化）

**新增文件**：
- `apps/web/src/utils/sanitize.ts` — 基于 DOMPurify 的净化工具，定义允许的标签与属性白名单，剥离 `<script>`、事件处理器、`javascript:` 协议。
- `apps/web/src/directives/safe-html/index.ts` — 全局指令 `v-safe-html`，等价于 `v-html` 但渲染前自动净化。

**改动文件**：
- `apps/web/src/main.ts` — 全局注册 `v-safe-html` 指令。
- `apps/web/src/views/Chat/components/Bubble.vue` — AI 返回的 Markdown 经 `marked.parse` 后用 `sanitizeHtml` 净化（风险最高，AI 内容不可信）。
- `apps/web/src/views/WordBook/index.vue` — `v-html` → `v-safe-html`。
- `apps/web/src/views/Course/Learn/index.vue` — 两处 `v-html` → `v-safe-html`（释义、翻译）。
- `apps/web/src/components/Search/index.vue` — `v-html` → `v-safe-html`。

新增依赖：`dompurify@^3.4.11`（web）。

### P4 启用全局输入验证

**文件**：`server/apps/server/src/main.ts`

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,          // 剥离 DTO 未声明的字段
    forbidNonWhitelisted: true, // 出现未声明字段直接报错
    transform: true,          // 自动类型转换
  }),
);
```

**新增 DTO 文件**（class 形式，带 class-validator 装饰器）：
- `server/apps/server/src/user/dto/register-user.dto.ts` — 校验用户名长度、手机号格式、邮箱格式、密码长度。
- `server/apps/server/src/user/dto/login-user.dto.ts` — 校验手机号格式、密码非空。
- `server/apps/server/src/user/dto/update-user.dto.ts` — 校验各字段类型与长度。

**文件**：`server/apps/server/src/user/user.controller.ts` — controller 入参从 TypeScript `type` 改为 class DTO，使验证装饰器生效。

新增依赖：`class-validator@^0.15.1`、`class-transformer@^0.5.1`（server）。

### P5 限流与认证加固

**文件**：`server/apps/server/src/user/user.controller.ts`

- `register`：加 `@UseGuards(ThrottlerGuard)` + `@Throttle({ default: { limit: 5, ttl: 60_000 } })`，防止批量注册。
- `refresh-token`：加 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`，防止刷新接口被滥用。
- `upload-avatar`：加 `@UseGuards(AuthGuard)` 要求登录；`FileInterceptor` 增加 `limits`（5MB）与 `fileFilter`（仅允许 `image/*`），防止未授权上传与恶意文件。

---

## 三、验证结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| server 类型检查 | `npx tsc --noEmit -p apps/server/tsconfig.app.json` | ✅ 通过（0 错误） |
| web 类型检查 | `npx vue-tsc --noEmit -p tsconfig.app.json` | ✅ 通过（0 错误） |
| `.env` 是否被跟踪 | `git ls-files \| grep -i "\.env"` | ✅ 未跟踪 |

---

## 四、遗留项（需单独排期）

1. **accessToken 仍存 localStorage**：改为内存或 httpOnly cookie 涉及前端架构调整（axios 拦截器、刷新时机等），风险较高，建议单独排期。当前 accessToken 15 分钟过期，风险可控。
2. **生产环境密钥轮换**：若 `.env` 曾在历史提交中泄露，需轮换 JWT/DB/MinIO/支付宝/邮箱/DeepSeek 等所有密钥。可用 `git log --all --full-history -- server/.env` 核查历史。
3. **CORS_ORIGIN 生产配置**：部署时需在环境变量中设置具体的线上域名。
