# 安全修复设计思路文档（2026-07-06）

> 本文阐述第二轮安全审计修复的整体设计思路与关键决策依据，配套文件：
> - 漏洞清单与计划：`security-audit-2026-07-06.md`
> - 修复详情与验证：`security-fix-report-2026-07-06.md`

---

## 一、总体设计原则

本次修复遵循三条原则：

1. **纵深防御（Defense in Depth）**：不依赖单一防线。例如前端已有表单校验，但后端必须独立校验；CORS 已收窄，同时 helmet 补齐安全头。
2. **最小侵入**：优先在框架既有机制上扩展，避免大范围重构。例如限流复用已引入的 `@nestjs/throttler`，输入验证用 NestJS 原生 `ValidationPipe`，而非引入第三方中间件。
3. **不破坏现有功能**：CORS 收窄时保留 tracker SDK 跨域上报与 cookie 刷新能力；DTO 改造时保持与服务层类型契约一致。

---

## 二、P2：Helmet + CORS 白名单

### 2.1 Helmet

**思路**：HTTP 安全响应头（CSP、X-Frame-Options、X-Content-Type-Options、HSTS 等）是抵御点击劫持、MIME 嗅探、降级攻击的基础防线。手写每个头易遗漏且难维护，`helmet` 是 Node.js 生态的事实标准，一行中间件即可统一注入。

**决策**：`app.use(helmet())` 放在所有业务中间件之前，确保响应头对所有路由生效。

### 2.2 CORS 白名单

**问题**：原配置 `origin: true` + `credentials: true` 意味着任意网站都能发起携带 cookie 的跨域请求，是 CSRF 类攻击的温床。

**设计难点**：本项目有两个合法跨域场景——
- 前端 dev server（端口 8080/5173）调用 API
- tracker SDK 通过 `sendBeacon`/`fetch` 上报埋点

若直接锁死单一域名，会破坏开发环境与 tracker。

**决策**：采用「环境变量驱动 + 开发兜底」的白名单策略——
```
CORS_ORIGIN=https://a.com,https://b.com   ← 生产环境显式配置
未配置时 → 默认放行 localhost:8080/5173    ← 开发环境开箱即用
```

**校验逻辑**：`origin` 回调中，`origin` 为 `undefined`（同源/服务端请求）直接放行；在白名单内放行；否则拒绝。这样既收窄了攻击面，又不影响合法跨域。

### 2.3 Socket.IO CORS

同样收窄为白名单。WebSocket 没有 SameSite cookie 保护，开放的 `origin: "*"` 风险更高，必须与 HTTP 保持一致策略。

---

## 三、P3：XSS 防护 —— DOMPurify + v-safe-html 指令

### 3.1 风险分析

项目有 5 处 `v-html`，风险分两类：
- **高风险**：`Bubble.vue` 渲染 AI 返回的 Markdown。AI 输出本质不可信，prompt 注入可诱导其返回 `<img onerror=...>` 等恶意载荷。
- **中风险**：词库翻译/释义。数据来自数据库，理论上可信，但若录入链路被污染（后台注入、数据导入），同样会触发存储型 XSS。

### 3.2 方案选型

| 方案 | 优点 | 缺点 | 采用 |
|------|------|------|------|
| A. 每处 `v-html` 手动调 `sanitizeHtml` | 直观 | 5 处重复，易遗漏 | ❌ |
| B. 全局指令 `v-safe-html` | 一处实现、统一行为、替换即用 | 需注册指令 | ✅ |

**决策**：采用方案 B，全局注册 `v-safe-html` 指令。理由：
1. **一致性**：所有富文本渲染走同一净化逻辑，避免某处漏净化。
2. **可维护**：净化策略（允许标签/属性白名单）集中在 `utils/sanitize.ts`，未来调整只改一处。
3. **低迁移成本**：`v-html` → `v-safe-html` 仅改指令名，模板其余不变。

### 3.3 净化策略设计

`sanitize.ts` 中显式声明 `ALLOWED_TAGS` 与 `ALLOWED_ATTR` 白名单：
- 允许排版标签（`p`/`b`/`i`/`code`/`pre`/`table` 等）与 Markdown 常见输出
- 允许 `href`/`src`/`alt`/`class` 等安全属性
- 禁止 `ALLOW_DATA_ATTR`，剥离所有 `data-*`（防止 data 属性被滥用）
- DOMPurify 默认剥离 `<script>`、`on*` 事件处理器、`javascript:` 协议

`Bubble.vue` 的 AI Markdown 单独走 `sanitizeHtml(marked.parse(...))`，因为需在 `marked` 转换 HTML 后再净化（先解析 Markdown→HTML，再剥离 HTML 中的恶意载荷）。

### 3.4 指令实现要点

指令需同时实现 `mounted` 与 `updated` 钩子：`mounted` 处理首次渲染，`updated` 处理数据变化（如 AI 流式输出、翻页）后的重新净化。否则动态内容更新时不会触发净化。

---

## 四、P4：输入验证 —— ValidationPipe + class DTO

### 4.1 问题本质

原 DTO 是 TypeScript `type`（`packages/common/user/index.ts`）：
```ts
export type UserRegister = Pick<User, "name" | "phone" | "email" | "password">;
```
`type` 是**编译期类型**，运行时被完全擦除。这意味着：
- NestJS 收到的 `@Body()` 是个普通对象，没有任何运行时校验
- 绕过前端直接调 API 可传入任意字段、任意类型、超长字符串
- 没有 `whitelist`，多余字段会被透传到服务层/数据库

### 4.2 方案选型：新建 class DTO vs 改造共享 type

| 方案 | 说明 | 问题 |
|------|------|------|
| A. 把共享 `type` 改成 `class` | 一处定义，前后端共用 | 前端引入 `class-validator` 装饰器是无谓依赖；class 在前端 bundle 体积增加；破坏「前端只用类型」的边界 |
| B. server 内新建 class DTO | 后端独立校验，前端类型不变 | 前后端两份定义需手动同步 | ✅ |

**决策**：方案 B，在 `server/apps/server/src/user/dto/` 新建 class DTO。

**理由**：
1. **关注点分离**：前端只需类型约束（编译期），后端需运行时校验（class-validator）。两者职责不同，定义分离更合理。
2. **不污染前端**：`class-validator` 装饰器是后端专属，不该出现在前端 bundle。
3. **同步成本低**：字段就那几个，且 DTO 字段必填性刻意与共享 `type` 保持一致（见 4.3），编译器会报不匹配错误，相当于自动校验同步。

### 4.3 字段必填性对齐

`UpdateUserDto` 的字段必填性刻意与 `UserUpdate`（共享 type）完全对齐：
- `name`/`isTimingTask`/`timingTaskTime` 必填（`!`）
- `email`/`address`/`avatar`/`bio` 可选（`?`）

**原因**：服务层 `updateUser(dto: UserUpdate)` 的类型契约要求这些字段必填。若 DTO 全设为可选（Partial 风格），TypeScript 会报类型不兼容。保持对齐让 DTO 实例结构满足服务层签名，无需改服务层。

### 4.4 ValidationPipe 配置

```ts
new ValidationPipe({
  whitelist: true,           // 剥离 DTO 未声明的字段
  forbidNonWhitelisted: true, // 出现未声明字段直接 400，而非静默剥离
  transform: true,           // plain object → DTO class 实例，并做类型转换
})
```

- `whitelist` + `forbidNonWhitelisted`：双重保险，既防字段注入又给出明确错误
- `transform: true`：使 `@Body()` 拿到的是 DTO 实例（装饰器元数据可用），并将 query/path 参数自动转类型

### 4.5 校验规则设计

- **手机号**：`/^1[3-9]\d{9}$/`（中国大陆 11 位）
- **邮箱**：`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`（基础格式）
- **密码**：长度 6-64（前端做了 MD5，后端 bcrypt，此处只防空/超长）
- **用户名**：长度 2-20
- 每条规则带中文 `message`，错误响应可直接展示给用户

---

## 五、P5：限流与认证加固

### 5.1 限流策略分级

| 接口 | 限流 | 理由 |
|------|------|------|
| `login` | 60s/5 次 | 防暴力破解（原有） |
| `register` | 60s/5 次 | 防批量注册垃圾账号 |
| `refresh-token` | 60s/10 次 | 防 token 刷新接口被刷（比登录略宽松，因需合法 refreshToken） |

**设计考量**：限流值不宜一刀切。登录/注册是高危入口，收紧到 5 次；刷新接口需持有有效 refreshToken 才有意义，攻击成本高，放宽到 10 次避免误伤正常用户频繁刷新。

### 5.2 上传头像的三重防护

原接口零防护（无认证、无类型校验、无大小限制），设计为三层：

1. **认证层**：`@UseGuards(AuthGuard)` —— 必须登录才能上传，杜绝匿名滥用存储。
2. **类型层**：`fileFilter` 校验 `mimetype.startsWith("image/")` —— 拒绝非图片（防上传 .html/.svg with script/可执行文件）。
3. **大小层**：`limits.fileSize: 5MB` —— 防 DoS 式大文件上传耗尽存储/内存。

三层在 `FileInterceptor` 配置中一次性声明，符合「校验前置」原则——在文件落盘前就拒绝，而非上传后再判断。

---

## 六、设计取舍与遗留

### 6.1 本次未做（刻意取舍）

| 项 | 原因 |
|----|------|
| accessToken 改存 httpOnly cookie | 涉及 axios 拦截器、刷新时机、SSR 兼容等架构调整，风险高；当前 15min 短期过期，风险可控，单独排期 |
| 服务层 `updateUser` 改为 Partial | 为保持向后兼容，DTO 字段必填性对齐现有契约而非改服务层签名 |
| 引入 `@nestjs/throttler` 全局守卫 | 当前按需在控制器级别加 `@UseGuards(ThrottlerGuard)`，避免影响埋点上报等高频接口 |

### 6.2 安全是持续工程

本次修复聚焦「已知漏洞的代码层加固」。完整的安全还需配合：
- **运维层**：HTTPS 部署、密钥轮换、`.env` 历史泄露核查
- **配置层**：生产环境 `CORS_ORIGIN` 显式设定域名
- **监控层**：限流触发告警、异常上传日志

这三层已在报告「遗留项」中标注，需运维/产品协同推进。
