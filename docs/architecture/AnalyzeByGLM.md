# 项目架构分析报告

> 英语学习平台 — 全栈 Monorepo 项目

---

## 一、项目概览

这是一个**全栈英语学习平台**，采用 pnpm monorepo 管理，涵盖前端 SPA、双后端微服务（业务 + AI）、前端监控 SDK、以及前后端共享类型包。

### 技术栈一览

| 层        | 技术                                        | 版本             |
| --------- | ------------------------------------------- | ---------------- |
| 前端框架  | Vue 3 + Vite                                | Vue 3.5 / Vite 8 |
| UI 库     | Element Plus + Tailwind CSS 4               | —                |
| 3D / 动画 | Three.js + GSAP                             | —                |
| 状态管理  | Pinia + pinia-plugin-persistedstate         | —                |
| 流式通信  | @microsoft/fetch-event-source (SSE)         | —                |
| 实时通信  | Socket.io Client                            | —                |
| 后端框架  | NestJS 11                                   | —                |
| ORM       | Prisma 7 + @prisma/adapter-pg               | —                |
| 数据库    | PostgreSQL                                  | —                |
| 消息队列  | BullMQ (Redis)                              | —                |
| 对象存储  | MinIO                                       | —                |
| 支付      | Alipay SDK                                  | —                |
| AI        | LangChain + DeepSeek + LangGraph Checkpoint | —                |
| 邮件      | Nodemailer                                  | —                |
| 监控 SDK  | FingerprintJS + ua-parser-js                | —                |

### Monorepo 结构

```
english/
├── apps/
│   ├── web/          # Vue 3 前端应用
│   └── tracker/      # 前端监控 SDK (PV/UV/性能/错误/事件)
├── server/
│   ├── apps/
│   │   ├── server/   # NestJS 业务服务 (:3000)
│   │   └── ai/       # NestJS AI 微服务 (:3001)
│   ├── libs/
│   │   └── shared/   # 后端公共模块 (Prisma/JWT/MinIO/Pay/Email/Interceptor)
│   └── prisma/       # 数据库 Schema + Migrations
├── packages/
│   ├── common/       # 前后端共享类型与 DTO
│   └── config/       # 端口等配置
└── resume/           # 简历素材
```

---

## 二、架构设计详解

### 2.1 双后端微服务架构

项目将后端拆分为两个独立 NestJS 应用：

- **业务服务** (`/api/v1`)：用户认证、课程管理、支付、词库、学习记录、WebSocket
- **AI 服务** (`/ai/v1`)：AI 对话（流式 SSE）、Prompt 管理、每日单词摘要邮件

两者通过共享 `@libs/shared` 模块复用 Prisma、JWT、MinIO 等基础设施，但独立部署、独立端口，实现了**业务与 AI 的解耦**。

### 2.2 AI 对话链路

```
前端 SSE POST /ai/v1/chat
  → ChatController (设置 text/event-stream)
    → ChatService.streamCompletion
      → createDeepSeek (模型实例, 支持深度思考开关)
      → createAgent (LangChain Agent, 注入 PostgresSaver checkpointer)
      → agent.stream({ messages }, { thread_id: userId-role, streamMode: 'messages' })
        → DeepSeek API (流式)
      → for await chunk → res.write('data: ...\n\n')
    → 前端 fetchEventSource.onmessage → 累加渲染 (打字机效果)
```

**关键设计**：

- **多角色隔离**：5 种角色（normal/master/business/qilinge/xiaoman），每种角色独立 systemPrompt
- **会话持久化**：`thread_id = userId-role`，通过 PostgresSaver checkpoint 实现服务重启不丢历史
- **深度思考开关**：`deepThink` 控制是否开启 DeepSeek thinking 模式 + 是否推送 reasoning 内容
- **联网搜索**：集成博查搜索 API，搜索结果拼接进 prompt

### 2.3 认证体系

- **双 Token 机制**：accessToken (15min) + refreshToken (7d)
- **前端无感刷新**：axios 响应拦截器捕获 401 → 自动刷新 → 请求队列重试
- **AuthGuard 路由守卫**：JWT 验证 + tokenType 校验，防止 access/refresh 互冒
- **密码安全**：前端 MD5 → 后端 bcrypt 二次加密

### 2.4 支付链路

```
用户点击购买 → PayService.create
  → 查重(是否已购买) → 创建订单 → Alipay SDK 生成支付 URL
  → 前端跳转支付宝 → 支付完成
  → Alipay 异步回调 /api/v1/pay/notify
    → 事务: 更新支付记录 + 创建课程记录
    → Socket.IO 推送 paymentSuccess 给前端
```

### 2.5 每日单词摘要 (AI + 队列)

```
BullMQ 定时任务 (每天 0 点)
  → DigestService.handleEmailDigest
    → 筛选活跃用户(开启定时任务 + 今天学过单词 + 有邮箱)
    → 为每个用户创建 LangChain Agent (带 tool: 查询用户单词记录)
    → Agent 生成 Markdown 报告 → marked 转 HTML
    → 按用户设定的定时时间 delay 后加入邮件队列
    → DigestProcessor 消费 → EmailService 发送
```

### 2.6 前端监控 SDK

独立的 Tracker SDK，采集 5 类数据：

- **UV**：FingerprintJS 生成匿名 ID + ua-parser-js 解析设备信息
- **PV**：页面访问记录（URL/referrer/path）
- **Event**：用户行为事件
- **Error**：JS 异常 + Promise 未捕获
- **Performance**：FP/FCP/LCP/INP/CLS 核心 Web 指标

### 2.7 前端工程化

- **createApi 工厂函数**：通过闭包创建多个 axios 实例（`serverRequest` / `aiRequest`），共享拦截器逻辑
- **泛型 Response\<T\>**：全链路类型推导，API 层声明泛型即可获得类型提示
- **Composable 模式**：useThreeScene（3D 场景引擎）、useSocket（WebSocket 管理）、useVoiceToText（语音识别）、useAudio（TTS 发音）
- **Three.js 资源治理**：onBeforeUnmount 递归释放 WebGLRenderer/Geometry/Material，ResizeObserver 自适应

---

## 三、亮点

### 1. AI 微服务独立部署 + LangGraph 会话持久化

AI 服务与业务服务物理隔离，通过 PostgresSaver checkpoint 实现对话历史的自动持久化，服务重启不丢失上下文。这是比"简单调 OpenAI API"高出一截的架构设计。

### 2. 前后端类型安全共享

`@en/common` 包定义了所有 DTO 和类型（User/Chat/Pay/Word/Course/Tracker），前后端引用同一份类型定义，消除了接口对接的类型不一致风险。

### 3. AI Agent + Tool Calling 实现自动化报告

Digest 模块不是简单调 LLM 生成文本，而是通过 LangChain `createAgent` + 自定义 `tool`（查询用户单词记录），让 Agent 自主决策数据查询和报告生成，体现了 Agent 架构的实际应用。

### 4. 前端 Token 无感刷新 + 请求队列

401 拦截 → 自动刷新 → 等待队列批量重试，避免了多请求并发时重复刷新的问题，是生产级的认证处理方案。

### 5. Three.js 场景引擎 Composable

将场景/相机/渲染器/控制器/ResizeObserver/动画循环/资源销毁封装为通用 Hook，多个组件复用，体现了对 WebGL 渲染管线和 Vue 组合式 API 的深入理解。

### 6. 全链路监控 SDK

从 PV/UV 到性能指标到错误捕获，自研前端监控体系，数据模型完整（Visitor → PageView/TrackEvent/PerformanceEntry/ErrorEntry），体现了对前端可观测性的系统思考。

### 7. 支付闭环完整

从订单创建 → 支付宝跳转 → 异步回调 → 事务保证（支付记录 + 课程记录原子写入）→ WebSocket 实时通知前端，形成了完整的支付闭环。

---

## 四、难点

### 1. SSE 流式输出的工程化处理

- 后端需要手动设置 `text/event-stream` 响应头 + `for await` 迭代 LangChain stream
- 前端使用 `@microsoft/fetch-event-source` 而非原生 EventSource（因为需要 POST + 自定义 headers）
- 深度思考模式下需要区分 `reasoning` 和 `chat` 两种消息类型分别推送

### 2. LangGraph Checkpoint 的会话隔离

- `thread_id` 的设计需要同时满足"用户隔离"和"角色隔离"
- PostgresSaver 需要在模块初始化时 `setup()` 自动建表
- 历史消息的序列化/反序列化由框架处理，但需要理解 `AIMessageChunk` 的结构

### 3. 支付回调的可靠性

- 支付宝异步回调可能重复发送，需要幂等处理
- 支付记录和课程记录必须在同一事务中
- 回调 body 的解析（`req.body.body` 是 JSON 字符串需要二次 parse）

### 4. Three.js 性能与资源管理

- WebGL 资源不释放会导致 GPU 内存泄漏
- `setSize(w, h, false)` 的第三个参数需要理解绘图缓冲区与 CSS 尺寸的分离
- OrbitControls 与自动旋转的冲突（Scene 旋转 vs Model 旋转）

### 5. 前端监控 SDK 的数据采集

- FingerprintJS 生成设备指纹的时机和缓存
- 性能指标的采集时机（需要在页面加载完成后）
- 错误捕获需要同时覆盖 `window.onerror` 和 `unhandledrejection`

### 6. BullMQ 定时任务 + 延迟队列的组合

- 每日 0 点触发全量扫描 → 为每个用户按其设定时间 delay → 到点发送邮件
- 这种"定时 + 延迟"的组合队列模式比单纯定时任务复杂

---

## 五、可优化的地方

### 🔴 安全（高优先级）

| #   | 问题                                        | 位置                 | 建议                                            |
| --- | ------------------------------------------- | -------------------- | ----------------------------------------------- |
| 1   | **refreshToken 无状态，无法主动吊销**       | `auth.service.ts`    | 数据库增加 `tokenVersion` 字段，刷新时校验      |
| 2   | **刷新后旧 refreshToken 仍可用**            | `user.service.ts`    | refreshToken 单次使用，刷新后立即失效           |
| 3   | **登录接口无暴力破解防护**                  | `user.controller.ts` | 引入 `@nestjs/throttler` 限流                   |
| 4   | **refreshToken 存 localStorage (XSS 风险)** | `stores/user.ts`     | 改存 httpOnly cookie                            |
| 5   | **Socket.IO CORS 全开** `origin: "*"`       | `socket.gateway.ts`  | 限制为前端域名                                  |
| 6   | **支付回调未验签**                          | `pay.service.ts`     | 使用 `alipaySdk.checkNotifySign()` 验证回调签名 |
| 7   | **AI 接口无认证**                           | `chat.controller.ts` | 添加 AuthGuard，防止未授权调用                  |
| 8   | **.env 文件在仓库中**                       | `server/.env`        | 加入 .gitignore，使用 .env.example              |

### 🟡 架构（中优先级）

| #   | 问题                                              | 建议                                                                                              |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 9   | **Prisma Service 每次请求共享单例但无连接池配置** | 配置 `connection_limit` 和 `pool_timeout`                                                         |
| 10  | **Interceptor 用 `new` 实例化而非 DI**            | `main.ts` 中 `new InterceptorInterceptor()` 应改为 APP_INTERCEPTOR provider 注入，否则无法使用 DI |
| 11  | **AI 服务每次请求都 createAgent**                 | Agent 可缓存复用（同 role + 同 model 配置），避免重复创建                                         |
| 12  | **createDeepSeek temperature=1.3**                | 温度过高可能导致输出不稳定，建议对话场景用 0.7-1.0                                                |
| 13  | **博查搜索结果直接拼入 prompt**                   | 搜索结果无长度限制，可能超出 token 上限，应做截断                                                 |
| 14  | **Tracker SDK 文件几乎为空**                      | `pv/error/performance/event/report` 模块只有 import 无实现，需补全                                |
| 15  | **无单元测试 / E2E 测试**                         | 配置了 Jest 但没有测试文件，核心逻辑（支付/认证/AI）应补测试                                      |

### 🟢 工程化（低优先级）

| #   | 问题                                   | 建议                                                             |
| --- | -------------------------------------- | ---------------------------------------------------------------- |
| 16  | **app.controller.ts 有两个 return**    | 第 15 行 `return this.appService.getHello()` 是死代码            |
| 17  | **course.service.ts 残留 console.log** | `console.log(list)` 应移除                                       |
| 18  | **Interceptor 命名不规范**             | `InterceptorInterceptor` / `InterceptorExceptionFilter` 命名冗余 |
| 19  | **prompt.mode.ts 硬编码角色**          | 可迁移到数据库或配置文件，支持动态添加                           |
| 20  | **MinIO 桶策略全公开读**               | 头像等用户数据应改为预签名 URL 访问                              |
| 21  | **无 Docker / CI 配置**                | 添加 Dockerfile + docker-compose，一键启动所有依赖               |
| 22  | **TypeScript 6.0.3**                   | 版本较新，确认与所有依赖兼容                                     |

---

## 六、总结

这是一个**完成度相当高的全栈项目**，涵盖了前端 3D 可视化、AI 对话、支付闭环、定时任务、前端监控等多个复杂场景。架构上最大的亮点是 **AI 微服务的 LangGraph 会话持久化**和**前后端类型安全共享**，这两个设计在同类项目中是比较少见的。

最需要优先处理的是**安全相关问题**（支付验签、Token 吊销、接口认证），这些在生产环境中是必须修复的。其次是**Tracker SDK 的补全**和**测试覆盖**，目前 Tracker 的 5 个模块几乎为空壳，与数据库 Schema 的设计不匹配。

整体来看，这个项目适合作为**简历项目展示**，resume 目录中的素材也说明了这一点。建议在面试中重点讲 AI 对话链路 + 支付闭环 + 前端工程化三个方向。
