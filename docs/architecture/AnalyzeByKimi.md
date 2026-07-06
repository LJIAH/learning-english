The user wants me to analyze the entire project architecture, highlights, difficulties, and optimization opportunities. They mentioned that tracker is still under development so I should ignore it. I need to explore the codebase thoroughly. This is a broad codebase exploration task. I should use the code-explorer subagent to gather information efficiently.

First, let me invoke the code-explorer subagent to explore the project structure. I'll ask it to analyze the architecture, key packages, apps, server structure, and any notable patterns or tech stack.
The subagent output was truncated. I need to get the full picture. I should read the key files myself to provide a comprehensive answer. Let me gather the most important files: package.json, pnpm-workspace, server structure, prisma schema, etc. I should run multiple parallel reads.
Good, I have the high-level structure. Now I need to read the server package.json, nest-cli.json, prisma schema, key apps files, and web package.json. I'll run parallel reads.
I need to dig deeper into the server structure. Let me list the apps/server/src and apps/ai/src directories, and read key files like main.ts, module files, and shared lib structure.
I should read the main.ts files, app modules, ai module, shared module, and a few key service files to understand patterns. Let me also read the web main.ts, router, and api index.
I need more details on the AI service (chat, digest, llm), server modules, and web structure. Let me read key files in parallel: the chat controller/service, llm service, digest module, auth guard, prisma service, response interceptor, and some web views.
I need to look at the llm config file, and some more server modules. Let me also check the web router, stores, and some views to understand frontend patterns.
I need to look at a few more things: the auth service (to see token strategy), pay service (alipay integration), word-book service (for word learning logic), and the web views to understand UI. Also check if there are tests, env examples, and any TODO files.
I should read the TODO files since they likely contain known issues and optimization ideas. Also check scripts directory content. And look at the common package structure.
Good. Now I have a comprehensive understanding. Let me also check the web vite config, tsconfig, and any other important config. Also check the user service to see refresh token logic. And maybe the socket gateway.
I have enough information now. Let me also check the common package types to see what's shared, and maybe the course controller to see structure. Also look at the pay shared service. Then I'll compile a comprehensive analysis.
I have comprehensive information. Now I should compile the analysis. I need to be concise but thorough. I'll structure it as:

1. 项目架构 overview
2. 技术栈
3. 各模块详解 (front-end, back-end, shared, prisma schema)
4. 亮点/难点
5. 可优化的地方
6. 已知问题（引用 TODO files)

I should mention that tracker is under development and skip it. I should cite files using the required format.

Let me also note key observations:

- access token expiration: shared.module.ts says 15m but TODO says 10s. Wait, I read shared.module.ts and it says expiresIn: "15m". The TODO says it was 10 before. So maybe already fixed. I should verify. In shared.module.ts line 47 it says `signOptions: { expiresIn: "15m" }`. So this is fixed. The TODO is outdated.
- But auth.service.ts doesn't explicitly set access token expiration, relying on default. That's a minor issue.
- The Pay notify handler has a bug: `JSON.parse(req.body.body)` but req.body from alipay might not be JSON string - actually alipay returns form data, but the code does JSON.parse on req.body.body. Might work if they configured body parser to JSON. Not sure.
- The interceptor wraps all responses but doesn't handle when controller returns a string or non-object. Actually it does `data?.message`, so if data is string, `data?.message` is undefined, `data?.data` is undefined, so it returns `{ message: "请求成功", code: 200, success: true, data: null }` losing the string. But usually services return response objects.
- AI service uses LangGraph checkpointer with PostgresSaver for conversation history.
- Digest service uses BullMQ with cron pattern.
- Frontend has nice patterns: token refresh queue, SSE chat, Vue 3 composition API + Pinia.
- Prisma schema has typos: `brower` instead of `browser`.
- `Visitor.userId` is optional but relation is `onDelete: Cascade`.
- CORS origin "\*" in socket gateway.
- The monorepo has two levels: pnpm workspace with server as a package, and Nest monorepo inside server.
- `fix_links.bat` suggests pnpm symlinks issues on Windows.
- Common package uses wildcard exports but no build step; works because TS references source files directly.

I should present this clearly.
基于对代码库的梳理，下面是项目整体架构、核心亮点、难点与可优化点的分析（`apps/tracker` 按你的要求只简单提及，不展开源码）。

---

## 一、整体架构

这是一个 **pnpm workspace + 嵌套 NestJS monorepo** 的前后端一体项目，定位是“AI 英语学习平台”。

```
g:/test/Nest/english/
├── apps/
│   ├── web/          # Vue 3 + Vite 前端主站
│   └── tracker/      # 前端埋点 SDK（开发中，占位阶段）
├── server/           # NestJS 后端（自身又是一个 monorepo）
│   ├── apps/server/  # 业务 API（端口 3000）
│   ├── apps/ai/      # AI 服务（端口 3001）
│   ├── libs/shared/  # 共享 Nest 模块
│   └── prisma/       # Prisma schema / migrations
├── packages/
│   ├── common/       # 全栈共享 TS 类型
│   └── config/       # 端口等公共配置
├── TODO/             # 已知待办/问题清单
└── resume/           # 个人笔记
```

**技术栈**：

| 层级      | 技术                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------- |
| 包管理    | pnpm 11.9.0（`node-linker=hoisted`、`shamefully-hoist=true`，配合 `fix_links.bat` 处理 Windows 符号链接） |
| 前端      | Vue 3.5 + Vite 8 + TypeScript 6 + Pinia + Vue Router 5                                                    |
| UI        | Element Plus + Tailwind CSS v4 + `@element-plus/icons-vue`                                                |
| 特效/交互 | Three.js、GSAP、Web Speech API                                                                            |
| 后端      | NestJS 11 + TypeScript 6                                                                                  |
| ORM / DB  | Prisma 7.8 + PostgreSQL + `@prisma/adapter-pg`                                                            |
| 缓存/队列 | Redis + BullMQ                                                                                            |
| AI        | LangChain + DeepSeek + Bocha 搜索 + PostgresSaver（LangGraph checkpoint）                                 |
| 存储      | MinIO                                                                                                     |
| 支付      | 支付宝 SDK                                                                                                |
| 邮件      | Nodemailer                                                                                                |
| 实时通信  | Socket.IO                                                                                                 |

---

## 二、核心模块详解

### 1. 前端 `apps/web`

- 入口：`apps/web/src/main.ts`
- 路由：`apps/web/src/router/index.ts`
- 状态：`apps/web/src/stores/user.ts`
- 请求封装：`apps/web/src/apis/index.ts`

主要功能：首页营销页（Three.js Hologram + GSAP 滚动动画）、AI 对话（SSE 流式）、词库检索、课程购买与学习、全局搜索、用户设置等。

请求层做了比较完整的处理：统一 `serverRequest`（`/api/v1`）和 `aiRequest`（`/ai/v1`），内置 401 token 刷新队列、token 自动注入、网络错误提示。

```ts
// apps/web/src/apis/index.ts:17-133
const createApi = (baseURL: string) => { ... };
export const serverRequest = createApi("/api/v1");
export const aiRequest = createApi("/ai/v1");
```

Vite 代理配置将 `/api` → `localhost:3000`、`/ai` → `localhost:3001`：

```ts
// apps/web/vite.config.ts:12-20
proxy: {
  "/api": { target: `http://localhost:${Config.ports.server}`, changeOrigin: true },
  "/ai": { target: `http://localhost:${Config.ports.ai}`, changeOrigin: true },
}
```

### 2. 后端 `server`

`server` 本身是一个 Nest monorepo：

- `apps/server`：业务 API，监听 3000，前缀 `/api/v1`
- `apps/ai`：AI 服务，监听 3001，前缀 `/ai/v1`
- `libs/shared`：全局共享模块（Prisma、MinIO、支付、邮件、JWT、响应封装、BullMQ、拦截器/过滤器）

两个应用都统一使用了：

```ts
// server/apps/server/src/main.ts:10-13
app.useGlobalInterceptors(new InterceptorInterceptor());
app.useGlobalFilters(new InterceptorExceptionFilter());
app.setGlobalPrefix("api");
app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
```

业务模块包括：

| 模块        | 说明                                                 |
| ----------- | ---------------------------------------------------- |
| `auth`      | JWT 双 token 签发                                    |
| `user`      | 登录/注册/刷新 token/上传头像/更新用户信息           |
| `word-book` | 词库分页检索，按中高考/四六级/GRE/雅思托福等标签筛选 |
| `course`    | 课程列表、我的课程                                   |
| `learn`     | 课程学习：按课程类型取 10 个未掌握单词，保存学习记录 |
| `pay`       | 支付宝下单、回调、通过 Socket.IO 通知前端            |
| `socket`    | Socket.IO 网关，按 `userId` 分房间                   |

AI 模块包括：

| 模块     | 说明                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| `chat`   | SSE 流式对话，支持角色切换、深度思考、联网搜索，基于 LangGraph + PostgresSaver 持久化会话 |
| `prompt` | 各角色系统提示词                                                                          |
| `llm`    | DeepSeek / Bocha 搜索 / checkpoint 初始化                                                 |
| `digest` | 每日单词学习邮件摘要，基于 BullMQ 定时任务                                                |

### 3. 共享层 `libs/shared`

`shared.module.ts` 标记为 `@Global()`，统一导出：

```ts
// server/libs/shared/src/shared.module.ts:12-24
@Global()
@Module({
  imports: [PrismaModule, ResponseModule, ConfigModule, JwtModule, MinioModule, PayModule, EmailModule, BullModule.forRootAsync(...)],
  exports: [SharedService, PrismaModule, ResponseModule, JwtModule, ConfigModule, MinioModule, PayModule, EmailModule],
})
```

关键服务：

- `PrismaService`：基于 `@prisma/adapter-pg` 的自定义 PrismaClient
- `InterceptorInterceptor`：统一响应格式 + `bigint` 转字符串
- `InterceptorExceptionFilter`：统一异常响应
- `AuthGuard`：JWT 校验，区分 `access`/`refresh` token
- `MinioService`：自动创建 bucket 并设置公开读策略
- `PayService`：初始化支付宝 SDK
- `EmailService`：邮件发送

### 4. 数据模型 `prisma/schema.prisma`

核心实体关系：

- `User` 1:N `WordBookRecord` N:1 `WordBook`（学习记录中间表）
- `User` 1:N `PaymentRecord`
- `User` 1:N `CourseRecord` N:1 `Course`（购买记录中间表）
- `PaymentRecord` 1:N `CourseRecord`
- `Visitor` 1:N `PageView` / `TrackEvent` / `PerformanceEntry` / `ErrorEntry`（埋点统计）

索引设计比较合理，例如 `WordBook` 按 `word`/`tag`、`PageView` 按 `[visitorId, createdAt]` 等。

---

## 三、亮点

1. **AI 会话架构清晰**
   - 使用 `LangGraph` + `PostgresSaver` 做对话状态持久化，通过 `thread_id = userId-role` 隔离不同角色会话。
   - 支持 SSE 流式输出、深度思考过程展示、Bocha 联网搜索。
   - 模型配置集中管理，统一使用 DeepSeek v4-flash，通过 `modelKwargs.thinking` 控制思考开关：

   ```ts
   // server/apps/ai/src/llm/llm.config.ts:6-22
   export const createDeepSeek = (configService, deepThink = false) => { ... };
   ```

2. **双 token + 刷新队列**
   - 后端区分 `accessToken` / `refreshToken`，`tokenType` 防止冒充。
   - 前端实现刷新 token 等待队列，避免并发 401 时多次刷新：

   ```ts
   // apps/web/src/apis/index.ts:20-31
   let isRefreshing = false;
   let pendingQueue = [];
   const flushQueue = (token, err?) => { ... };
   ```

3. **支付闭环完整**
   - 支付宝下单 → 回调更新订单 → 创建课程记录 → Socket.IO 实时通知前端支付成功。

4. **定时任务设计**
   - `DigestService` 使用 BullMQ 每日 0 点触发，再按用户设置的 `timingTaskTime` 延迟发送邮件摘要。
   - Agent 查询用户当日学习记录并生成记忆报告。

5. **前端工程化**
   - 请求/响应类型通过 `packages/common` 全栈共享。
   - Pinia 持久化用户状态，Vue Router 做登录守卫。

6. **统一响应格式**
   - 后端通过拦截器和异常过滤器统一了 `{ timestamp, path, message, code, success, data }` 结构。

---

## 四、难点 / 复杂点

1. **AI 流式输出的错误处理**
   - SSE 流在异常中断时（网络波动、AI 服务异常）前端没有明显的断线重连或错误提示逻辑。
   - `chat.controller.ts` 直接 `for await` 写流，如果 `chatService.streamCompletion` 抛错，没有 `try/catch` 给客户端发送错误事件。

2. **支付宝回调的健壮性**
   - `pay.service.ts` 的 `notify` 没有校验支付宝签名，直接解析 `req.body.body`，存在伪造回调风险。
   - 支付回调应使用支付宝 SDK 的 `checkNotifySign` 验签。

3. **AI 服务与业务服务的数据耦合**
   - `DigestService` 在 `apps/ai` 中直接查询 `prisma.user` 和 `wordBookRecords`，AI 服务与业务数据库表耦合较深，未来拆分/独立部署会变重。

4. **BullMQ 定时任务的幂等**
   - `DigestService.onModuleInit` 每次启动应用都会 `digestQueue.add(repeat: ...)`，BullMQ 默认会按 jobId 去重，但这里没有显式指定 jobId，重启可能堆积重复 repeatable job。

5. **前端 token 刷新竞态**
   - 刷新队列实现已经不错，但 `isRefreshing` 是局部变量，多个 `createApi` 实例之间不共享状态；当前两个实例分别处理 `/api` 和 `/ai`，如果同时过期会触发两次刷新。

6. **Windows 开发环境**
   - `.npmrc` 使用 `node-linker=hoisted`、`shamefully-hoist=true`，并存在 `fix_links.bat`，说明 Windows 下 pnpm 的硬链接/符号链接有兼容问题，开发环境维护成本较高。

---

## 五、可优化的地方

### 架构 / 工程化

1. **补齐 CI/CD 与 env 示例**
   - 没有看到 `.env.example` 或 Dockerfile，新成员接入成本高。建议补全 `.env.example`、README 环境说明、以及 `docker-compose.yml`（PostgreSQL + Redis + MinIO）。

2. **统一错误码**
   - 当前 `ResponseService` 返回 `code: 200/500` 等 HTTP 状态码，缺少业务错误码，建议增加业务 `errorCode` 枚举。

3. **API 文档**
   - 没有使用 Swagger/OpenAPI，随着接口增多维护困难，建议接入 `@nestjs/swagger`。

4. **分层测试**
   - 项目配置了 Jest，但没有看到有效的单元/E2E 测试覆盖核心业务（支付、AI 对话、学习记录）。

5. **类型共享包的构建**
   - `packages/common` 使用 `"./\*": "./*/index.ts"` 直接暴露源码，没有 `build` 步骤，依赖方通过 TS 引用源文件。可以补 `tsc` 构建产物，提高发布/消费稳定性。

### 后端

6. **刷新 token 状态化**
   - `refreshToken` 当前是纯 JWT，服务端无状态，无法吊销。参考 `TODO/security-issues.md` 的建议，增加 `tokenVersion` 或 refreshToken 白名单，并实现单次使用刷新。

7. **API 限流**
   - 登录/注册等接口没有限流，建议接入 `@nestjs/throttler`。

8. **AI 服务解耦**
   - 将 `DigestService` 中对业务库的查询抽成接口或事件，AI 服务只消费数据，不直接访问业务 schema。

9. **支付宝回调验签**
   - 必须增加签名验证，并幂等处理同一 `out_trade_no` 的多次通知。

10. **WebSocket CORS**
    - `socket.gateway.ts` 设置了 `origin: "*"`，生产环境应改为明确域名。

11. **敏感配置管理**
    - 私钥、API Key 均通过 `ConfigService` 从 `.env` 读取，基本没问题，但建议增加配置校验（如 `joi` / `class-validator`），避免启动后才发现缺配。

### 前端

12. **refreshToken 存储安全**
    - 当前 `refreshToken` 随 Pinia 持久化到 `localStorage`，存在 XSS 风险。建议改为 `httpOnly` cookie，或至少将 token 拆分存储。

13. **SSE 连接管理**
    - 增加 AbortController 超时控制、断线重连、错误事件提示。

14. **状态管理拆分**
    - `user.ts` 同时承担用户信息和 token 职责，建议将 token 与用户信息 store 分离。

15. **组件/逻辑复用**
    - 部分页面可能直接写业务逻辑，可进一步抽象 composable（如 useSSE、useAuth）。

### 数据层

16. **Schema 细节修正**
    - `Visitor.brower` 拼写错误，应为 `browser`。
    - `Visitor.userId` 是可选，但 `User` 删除时级联删除 `Visitor`，逻辑上需确认是否合理。
    - `WordBook` 的 `frq` 用字符串排序可能不符合预期（如果实际存的是数字，应改为 `Float`）。

### 埋点 `tracker`

17. **后续接入建议**
    - 后端表已预留，SDK 完成后需考虑：采样率、批量上报、离线缓存、敏感信息脱敏、上报域名收敛。

---

## 六、参考的已知问题清单

`TODO/` 下已有两份文档记录：

- `TODO/learn-improvements.md`：背单词页面趣味性优化（动态记忆时间、模糊隐藏释义、动画反馈、星级自评、间隔重复、混合通关机制）。
- `TODO/security-issues.md`：双 Token 认证问题（accessToken 过期、refreshToken 无状态/复用、登录暴力破解、localStorage 存储风险）。

其中 `accessToken` 过期时间在 `server/libs/shared/src/shared.module.ts` 中已经是 `expiresIn: "15m"`，说明之前提到的“10 秒”问题已修复；`auth.service.ts` 仍依赖全局默认值，建议显式指定以提高可读性。

---

**总结**：项目整体架构清晰，AI 学习场景的功能闭环（聊天、学习、支付、邮件摘要）已经跑通，前后端都有一定的工程化意识。下一步建议优先处理**支付回调安全、token 状态化/SSE 健壮性、补齐文档与测试**，再逐步做性能与体验优化。
