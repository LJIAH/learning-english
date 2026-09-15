# 项目安全措施总览（2026-07-06）

> 本文档系统归纳本项目（NestJS 后端 + Vue 前端 + Tracker SDK）已实施的全部安全措施，按防护层次组织。
> 相关文档：
> - 第一轮认证修复：`security-issues.md`
> - 第二轮审计与修复：`security-audit-2026-07-06.md` / `security-fix-report-2026-07-06.md` / `security-design-2026-07-06.md`

---

## 一、认证与授权

### 1.1 双 Token 机制（access + refresh）

| 项 | 措施 | 实现位置 |
|----|------|----------|
| accessToken | 15 分钟过期，显式 `expiresIn: '15m'` | `auth.service.ts` |
| refreshToken | 7 天过期，显式 `expiresIn: '7d'` | `auth.service.ts` |
| tokenType 区分 | payload 携带 `tokenType: 'access'/'refresh'`，防止互冒 | `auth.service.ts` / `auth.guard.ts` |

- accessToken 用于接口访问，refreshToken 用于续期，职责分离。
- AuthGuard 校验 `tokenType === 'access'`，refresh 接口校验 `tokenType === 'refresh'`，双向防冒充。

### 1.2 refreshToken 吊销与单次使用

| 项 | 措施 | 实现位置 |
|----|------|----------|
| tokenVersion 字段 | 数据库 `User.tokenVersion`，JWT payload 携带 | `schema.prisma` / `auth.service.ts` |
| 主动吊销 | 登出时 `tokenVersion + 1`，所有已签发 token 立即失效 | `user.service.ts` `logout` |
| 单次使用 | 刷新成功后 `tokenVersion + 1`，旧 refreshToken 立即失效 | `user.service.ts` `refreshToken` |
| 刷新校验 | 比对 payload.tokenVersion 与数据库值，不匹配则拒绝 | `user.service.ts` `refreshToken` |

解决了纯 JWT 无状态导致「Token 永生」「刷新后旧 token 仍可用」的问题。

### 1.3 路由级鉴权

- `AuthGuard`（JWT 守卫）保护敏感接口：`logout`、`upload-avatar`、`update-user`。
- 守卫将解码后的 user 信息挂载到 `request.user`，供控制器使用。
- 异常消息统一为「token 已经过期或无效」，不泄露具体失败原因。

---

## 二、密码安全

| 项 | 措施 | 实现位置 |
|----|------|----------|
| 哈希算法 | bcrypt，盐轮 10 轮 | `user.service.ts` |
| 登录验证 | `bcrypt.compare()`，非常量时间比较由 bcrypt 保证 | `user.service.ts` `login` |
| 注册加密 | `bcrypt.hash(password, 10)` 后存储 | `user.service.ts` `register` |
| 前端预处理 | 密码先 MD5 再传输，后端 bcrypt 二次加密 | 前端 / `user.service.ts` |

- 最终存储的是 `bcrypt(MD5(password))`，真正的安全层是 bcrypt。
- 密码字段永不返回：`userSelect` 显式指定查询返回字段，排除 `password`。

---

## 三、Token 存储与传输

| Token | 存储位置 | 安全配置 | 理由 |
|-------|----------|----------|------|
| accessToken | 前端 Pinia（localStorage） | 15min 短期过期 | 短 TTL 降低泄露风险（注：理想应存内存/httpOnly，见遗留项） |
| refreshToken | httpOnly cookie | `httpOnly` + `secure`(生产) + `sameSite: 'lax'` + `path: '/api'` | 防 XSS 读取、防 CSRF、限制路径 |

- refreshToken 不再下发到前端响应体，仅通过 Set-Cookie 写入。
- cookie `secure` 在生产环境启用（仅 HTTPS 传输），`sameSite: 'lax'` 提供基础 CSRF 防护。

---

## 四、接口防护

### 4.1 限流（防暴力破解/滥用）

| 接口 | 限流策略 | 实现位置 |
|------|----------|----------|
| `login` | 60s / 5 次 | `user.controller.ts` |
| `register` | 60s / 5 次 | `user.controller.ts` |
| `refresh-token` | 60s / 10 次 | `user.controller.ts` |
| 默认（全局） | 60s / 100 次 | `user.module.ts` `ThrottlerModule.forRoot` |

- 基于 `@nestjs/throttler`，配合 `app.set('trust proxy', 1)` 在反向代理后获取真实客户端 IP。

### 4.2 文件上传防护

| 防护层 | 措施 | 实现位置 |
|--------|------|----------|
| 认证 | `@UseGuards(AuthGuard)` 必须登录 | `user.controller.ts` |
| 类型校验 | `fileFilter` 仅允许 `image/*` | `user.controller.ts` |
| 大小限制 | 拦截器层 5MB + 服务层二次校验 5MB | `user.controller.ts` / `user.service.ts` |

### 4.3 输入验证

| 项 | 措施 | 实现位置 |
|----|------|----------|
| 全局管道 | `ValidationPipe` + `whitelist` + `forbidNonWhitelisted` + `transform` | `main.ts` |
| DTO 校验 | class-validator 装饰器（手机号/邮箱格式、长度、必填） | `user/dto/*.ts` |
| 字段剥离 | 未声明字段自动剥离并报 400 | `main.ts` ValidationPipe |

- 服务端独立校验，不依赖前端表单验证。

---

## 五、HTTP 安全头与跨域

### 5.1 Helmet 安全头

- `app.use(helmet())` 统一注入 CSP、X-Frame-Options、X-Content-Type-Options、Strict-Transport-Security 等响应头。
- 防御点击劫持、MIME 嗅探、协议降级攻击。

### 5.2 CORS 白名单

| 层 | 措施 | 实现位置 |
|----|------|----------|
| HTTP API | 环境变量 `CORS_ORIGIN` 白名单，默认放行本地开发端口 | `main.ts` |
| WebSocket | Socket.IO 同白名单 + `credentials: true` | `socket.gateway.ts` |

- 生产环境通过 `CORS_ORIGIN=https://yourdomain.com` 显式限定，拒绝任意来源的带 cookie 跨域请求。

---

## 六、XSS 防护

| 场景 | 措施 | 实现位置 |
|------|------|----------|
| AI Markdown 渲染 | `marked.parse` → `sanitizeHtml`（DOMPurify）→ `v-html` | `Bubble.vue` / `utils/sanitize.ts` |
| 单词翻译/释义渲染 | 全局指令 `v-safe-html` 自动净化 | `WordBook` / `Course/Learn` / `Search` |
| 净化策略 | 显式标签/属性白名单，剥离 `<script>`/事件处理器/`javascript:` | `utils/sanitize.ts` |

- `v-safe-html` 指令统一替换 `v-html`，实现 `mounted`/`updated` 双钩子，覆盖动态内容更新。

---

## 七、数据层安全

| 项 | 措施 | 实现位置 |
|----|------|----------|
| SQL 注入防护 | 全部使用 Prisma ORM 参数化查询，无原生 SQL | 全后端 |
| ID 防枚举 | 主键使用 `cuid()` 而非自增整数 | `schema.prisma` |
| 唯一约束 | `phone`/`email` 字段 `@unique`，防重复注册 | `schema.prisma` |
| 字段过滤 | `userSelect`/`updateUserSelect` 显式指定返回字段，不泄露密码 | `user.select.ts` |
| 密钥管理 | JWT secret、DB、MinIO、支付宝等密钥通过 `.env` 注入，不硬编码 | `.env` / `shared.module.ts` |

---

## 八、其他

| 项 | 措施 | 实现位置 |
|----|------|----------|
| `.env` 防泄露 | 根目录与 `server/` 的 `.gitignore` 均包含 `.env` 规则，且未被 Git 跟踪 | `.gitignore` |
| 统一响应拦截 | `InterceptorInterceptor` 统一包装响应格式 | `main.ts` |
| 全局异常过滤 | `InterceptorExceptionFilter` 统一捕获异常，避免堆栈泄露 | `main.ts` |
| 反向代理适配 | `trust proxy: 1` 使限流器获取真实 IP | `main.ts` |

---

## 九、安全措施全景图

```
客户端请求
  │
  ├─ CORS 白名单校验 ───────────── (五)
  ├─ Helmet 安全头 ─────────────── (五)
  │
  ├─ 限流 Throttler ────────────── (四)
  ├─ ValidationPipe 输入验证 ──── (四)
  │
  ├─ AuthGuard 鉴权 ────────────── (一)
  │    └─ JWT verify + tokenType 校验
  │
  ├─ 业务逻辑
  │    ├─ bcrypt 密码校验 ──────── (二)
  │    ├─ tokenVersion 吊销校验 ── (一)
  │    ├─ 文件类型/大小校验 ────── (四)
  │    └─ Prisma 参数化查询 ────── (七)
  │
  ├─ 字段过滤 userSelect ───────── (七)
  ├─ 异常过滤(不泄露堆栈) ──────── (八)
  │
  └─ 响应
       ├─ refreshToken → httpOnly cookie (三)
       └─ accessToken → 响应体(15min)

前端渲染
  ├─ v-safe-html → DOMPurify 净化 (六)
  └─ accessToken → Pinia(localStorage)
```

---

## 十、遗留项（已知风险，待排期）

| 风险 | 现状 | 缓解 | 计划 |
|------|------|------|------|
| accessToken 存 localStorage | XSS 可读取 | 15min 短期过期 | 改存内存/httpOnly cookie，涉及架构调整 |
| 生产密钥轮换 | `.env` 当前未泄露到 Git | `.gitignore` 已生效 | 核查历史提交，若有泄露则轮换全部密钥 |
| 生产 CORS 配置 | 当前默认放行本地端口 | 环境变量已就绪 | 部署时设置 `CORS_ORIGIN` 为线上域名 |
| HTTPS 部署 | cookie `secure` 已按生产环境启用 | — | 生产环境强制 HTTPS |
