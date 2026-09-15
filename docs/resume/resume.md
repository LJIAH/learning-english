# AI 英语学习平台 — 项目简历话术

> 基于最新代码状态整理（含两轮安全加固、支付回调幂等加固、Tracker SDK 落地后的版本）。分四部分：可直接粘贴的简历文案、技术栈、难点亮点深挖（面试讲述版）、高频追问准备。

---

## 一、项目介绍（简历「项目经历」可直接粘贴）

### 一句话版本

> 独立开发的 AI 英语学习平台（pnpm Monorepo 全栈）：Vue 3 + NestJS 双服务 + PostgreSQL，覆盖 AI 流式对话、课程购买支付、单词学习闭环、自研前端监控 SDK 与每日学习报告推送。

### 完整版本（放简历项目描述栏）

**AI 英语学习平台**（全栈 · 独立开发）

采用 pnpm workspace 管理前端（Vue 3）、业务 API（NestJS）、AI 服务（NestJS）、前端监控 SDK 四个子包的 Monorepo 项目。后端按「业务 / AI」拆分为两个独立 NestJS 应用，通过全栈共享类型包 `@en/common` 消除前后端类型不一致。实现了 LangGraph 会话持久化的多角色 AI 流式对话、双 Token 认证体系、支付宝支付闭环、BullMQ 定时 AI 学习报告、自研前端监控 SDK（UV/PV/性能/错误/事件）等完整业务闭环。

---

## 二、简历要点条目（按模块挑 6~10 条使用）

### 架构

- 设计 pnpm workspace + 嵌套 Nest Monorepo 的双层工程结构，前端、业务 API（:3000）、AI 服务（:3001）三个应用独立开发部署，公共基础设施（Prisma/JWT/MinIO/支付/邮件）沉淀为 `libs/shared` 全局模块复用
- 建立全栈类型共享层：`packages/common` 统一维护 DTO 与响应类型，前端 API 层通过泛型 `Response<T>` 获得全链路类型推导，接口对接零类型歧义
- 统一响应拦截器 + 全局异常过滤器，所有接口返回标准化结构；URI 版本化（`/api/v1`、`/ai/v1`）控制 API 演进

### AI 对话（核心亮点）

- 集成 LangChain + DeepSeek 实现 SSE 流式对话：后端手写 `text/event-stream` 推流，前端用 `@microsoft/fetch-event-source` 消费（支持 POST + 自定义头），实现打字机渲染与 Markdown 实时转码
- 基于 LangGraph + PostgresSaver 实现对话状态持久化，以 `userId-role` 为 thread_id 实现「用户 × 角色」双维度会话隔离，服务重启不丢上下文；历史消息直接从 checkpoint 读取，支持含思考过程的完整回放
- 支持多角色人设（5 种 systemPrompt 动态装配）、深度思考开关（reasoning/chat 双通道消息分流渲染）、Bocha 联网搜索结果注入 Prompt

### 认证与安全（两轮安全迭代）

- 设计双 Token 体系：accessToken 15min / refreshToken 7d，payload 携带 `tokenType` 双向校验防止互冒；前端实现 401 无感刷新——请求队列 + 刷新锁，并发过期只触发一次刷新后统一重试
- 引入 `tokenVersion` 版本号机制解决无状态 JWT 无法吊销的问题：登出与刷新时版本号自增使旧 Token 全部失效，实现 refreshToken 单次使用；refreshToken 下发方式改为 httpOnly Cookie（secure + sameSite + path 限定），accessToken 保持短时效响应体下发，形成分级存储策略
- 完成两轮系统性安全加固：Helmet 安全头、CORS/Socket.IO 白名单、接口分级限流（登录/注册 60s/5 次、刷新 60s/10 次）、全局 ValidationPipe（whitelist + forbidNonWhitelisted）输入验证、上传接口认证 + 图片类型 + 5MB 三重校验
- 前端 XSS 治理：基于 DOMPurify 封装全局 `v-safe-html` 指令替代 `v-html`，对 AI 返回 Markdown、词库释义等所有动态 HTML 统一白名单净化

### 支付与实时通知

- 对接支付宝 SDK 完成下单 → 异步回调 → Prisma 事务原子写入（支付记录 + 课程记录）→ Socket.IO 按 userId 分房间实时推送支付结果的完整闭环；回调按「交易状态机幂等 + 复合唯一约束兜底」抵御支付宝重试通知，并按协议返回字面量 success/fail 控制重试节奏，推送移至事务提交后杜绝回滚误报

### 异步任务

- 基于 BullMQ + Redis 设计「定时 + 延迟」组合队列：每日 0 点 Cron 扫描活跃用户，LangChain Agent 通过 Tool Calling 自主查询用户当日学习记录生成 Markdown 记忆报告，再按用户自定义推送时间延迟入队，由邮件 Worker 消费发送

### 自研前端监控 SDK（apps/tracker）

- 从零实现前端监控 SDK，覆盖 UV（FingerprintJS 匿名指纹 + 登录后 setUserId 关联）、PV、行为事件、JS 异常（onerror + unhandledrejection）、Web 性能五大数据维度
- 性能采集基于 PerformanceObserver 获取 FP/FCP/LCP/INP/CLS，INP 不支持时自动降级 first-input；页面隐藏（visibilitychange）时统一上报并断开观察器
- 上报通道双方案：`sendBeacon`（Blob 载荷，页面卸载不丢数据）+ `fetch keepalive`；SDK 内部用 readyPromise 串联异步初始化，解决「指纹未就绪时调用 setUserId」的竞态问题
- 配套设计 Prisma 五表数据模型（Visitor/PageView/TrackEvent/PerformanceEntry/ErrorEntry），按 `[visitorId, createdAt]` 等复合索引预判查询模式

### 前端体验与可视化

- 封装 Three.js 场景引擎 Composable（场景/相机/渲染器/控制器/ResizeObserver/动画循环/资源销毁），多组件复用；onBeforeUnmount 递归释放 GPU 资源防内存泄漏；模型预加载 + visible 显隐切换方案将切换延迟从数百 ms 降至帧级别
- 请求层工厂函数 `createApi` 一次封装多后端实例（业务/AI），共享拦截器逻辑；搜索场景引入 AbortController 取消过期请求解决竞态覆盖

---

## 三、技术栈

| 分类 | 技术 |
| --- | --- |
| 工程 | pnpm workspace + Nest Monorepo（双层）、TypeScript、Vite |
| 前端 | Vue 3.5、Pinia（持久化）、Vue Router、Element Plus、Tailwind CSS v4 |
| 可视化 | Three.js、GSAP（ScrollTrigger） |
| 后端 | NestJS 11（双应用）、class-validator、@nestjs/throttler、helmet |
| 数据 | PostgreSQL、Prisma（@prisma/adapter-pg 直驱） |
| 异步 | Redis、BullMQ（Cron 定时 + Delayed 延迟队列） |
| AI | LangChain、LangGraph（PostgresSaver checkpoint）、DeepSeek、Bocha 搜索、Tool Calling |
| 实时/存储 | Socket.IO、MinIO |
| 业务 | 支付宝 SDK、Nodemailer |
| 监控 | 自研 Tracker SDK（FingerprintJS、PerformanceObserver、sendBeacon、DOMPurify） |

---

## 四、难点亮点深挖（面试讲述版：问题 → 方案 → 深度）

### 1. AI 流式对话的会话持久化与双维隔离 ⭐ 核心亮点

**问题**：LLM 本身无状态，多角色人设下如果上下文混在一起，不同角色的对话会互相污染；服务重启后历史丢失。

**方案**：
- 引入 LangGraph 的 PostgresSaver 作为 Agent checkpointer，对话状态自动 checkpoint 到 PostgreSQL
- thread_id 设计为 `userId-role`，一个字段同时完成「用户隔离」和「角色隔离」两个维度的寻址
- 历史回放不查自己的消息表，而是直接读 `checkpointer.get()` 的 `channel_values.messages`，连 reasoning_content（思考过程）都能完整还原

**可讲的深度**：为什么选 PostgresSaver 而不是自己存消息表（框架自动处理消息序列化/版本迁移，且支持时间旅行调试）；`streamMode: 'messages'` 拿到的是 AIMessageChunk 增量而非完整消息，前端按 chunk 累加。

### 2. 无状态 JWT 的吊销难题：tokenVersion 机制 ⭐ 最能体现安全思考

**问题**：纯 JWT 一旦签发无法作废——登出后 Token 仍是「永生」的；refreshToken 刷新后旧 Token 不失效，泄露后可无限续期。

**方案**：
- 用户表加 `tokenVersion` 字段并写入 JWT payload；登出时 +1，刷新成功时也 +1
- 每次刷新/鉴权比对 payload 中的版本号与数据库值，不匹配立即拒绝——一次自增即可吊销该用户所有存量 Token
- refreshToken 从响应体改为 httpOnly Cookie（`secure` + `sameSite: lax` + `path: /api`），JS 读不到、CSRF 打不到、只有刷新接口能携带；accessToken 保持响应体 + 15min 短时效，兼顾无感刷新与泄露面收敛

**可讲的深度**：这是「有状态校验 + 无状态签名」的折中方案——用一次 DB 读换取吊销能力；对比方案（refreshToken 白名单表、短 TTL + 静默续期）的取舍。

### 3. 并发 401 的无感刷新竞态

**问题**：页面并行发出 N 个请求，access 过期时全部 401，若各自触发刷新会重复请求刷新接口，且先返回的旧 Token 会互相覆盖。

**方案**：axios 响应拦截器内维护 `isRefreshing` 锁 + pending 队列；首个 401 触发刷新，后续 401 只入队等待；刷新成功后 flush 队列，用新 Token 重放全部失败请求；刷新失败则清空登录态跳转登录页。

**可讲的深度**：锁必须放在模块级闭包而非请求实例上；刷新接口本身要排除在拦截器外防止死循环。

### 4. SSE 全链路流式工程

**问题**：原生 EventSource 只支持 GET、不能带 Authorization 头，无法承载认证后的 AI 对话。

**方案**：后端 Controller 手动设置 `text/event-stream` + no-cache + keep-alive 响应头，`for await` 迭代 Agent stream 逐 chunk `res.write('data: ...')`；前端用 `@microsoft/fetch-event-source` 以 POST + 自定义头建连，onmessage 中区分 reasoning / chat 两类消息分别渲染，深度思考关闭时不推送 reasoning 省流量。

### 5. 「定时 + 延迟」组合队列的每日学习报告

**问题**：每个用户自定义了报告推送时间，而邮件任务必须统一触发点。

**方案**：BullMQ Cron 每日 0 点触发扫描 → 筛选「开启定时 + 当日有学习记录 + 有邮箱」的用户 → Agent 用自定义 Tool 查询该用户单词记录、自主决策生成 Markdown 报告（marked 转 HTML）→ 按每个用户的目标时间计算 delay 加入延迟队列 → 邮件 Worker 到点消费。一次 Cron + N 个 delayed job，把「个性化时间」问题转化为队列编排问题。

### 6. 自研监控 SDK 的三个工程细节

- **异步初始化竞态**：`init()`（指纹获取）是异步的，外部可能在就绪前调 `setUserId`；用 readyPromise 保证调用排队到 init 完成后执行
- **数据不丢**：上报用 `sendBeacon`（Blob 载荷），页面关闭也能发出；性能数据在 `visibilitychange` 隐藏时才统一上报最终值（LCP/CLS 的特性决定必须等生命周期后段），并 disconnect 所有 Observer 防泄漏
- **指标降级**：INP 用 `event` 类型 + 40ms 阈值采集，浏览器不支持时降级 first-input（FID）

### 7. 支付闭环的一致性

支付宝异步通知是 at-least-once 投递：商户未回 `success` 就按策略重发，重复通知直接执行会造成重复发放权益。方案四层：① 幂等——事务内先查 `tradeStatus`，已成功直接确认并跳过业务写入；课程记录以 `@@unique([userId, courseId])` 为锚用 upsert 兜底，重试不会撞唯一约束失败；② 原子性——Prisma 事务把「更新支付记录」与「创建课程记录」绑定，消除部分成功中间态；③ 协议正确性——注入 `@Res()` 绕过全局响应拦截器的 JSON 包装，返回字面量 `success`/`fail` 控制支付宝重试节奏；④ 时序——Socket.IO 推送移到事务提交后，回滚不会误报「支付成功」。资金状态与权益发放不出现中间态。

### 8. Three.js 渲染资源治理

WebGL 的 Geometry/Material/Texture 挂在 GPU 上，GC 不管。封装的 Composable 在 onBeforeUnmount 递归 traverse 释放全部资源；`setSize(w, h, false)` 第三参分离绘图缓冲区与 CSS 尺寸，配合 ResizeObserver 实现画布自适应；模型预加载进 Scene 后切换只改 `visible`，消除网络 IO 造成的白屏；OrbitControls 与自动旋转冲突的根因是旋转了整个 Scene（公转改变坐标系），改为模型自转 + Box3 包围盒动态校准 controls.target。

---

## 五、面试高频追问（提前准备答案）

| 追问 | 回答锚点 |
| --- | --- |
| 为什么 AI 服务独立拆一个应用？ | 职责/伸缩特性不同：AI 长连接流式、依赖 LangChain 重依赖栈，业务 API 要求快速响应；共享 libs 复用基础设施，代价是 AI 服务直读业务库（可演进为事件解耦） |
| LangGraph checkpoint 存了什么？ | 每轮对话后的完整消息通道状态，按 thread_id 版本化存 Postgres；get 时取 channel_values.messages 还原历史 |
| tokenVersion 的性能代价？ | 每次刷新多一次主键查询，可接受；对比白名单表方案少了存储与清理成本 |
| 为什么 accessToken 还放 localStorage？ | 已知权衡（XSS 面），靠 15min 短时效收敛风险；彻底方案是内存 + 静默续期，涉及刷新时机重构，列入排期 |
| 支付回调重复通知怎么办？ | 已落地：事务内先查 `tradeStatus` 幂等确认（重复通知回 success）；课程记录用复合唯一约束 + upsert 兜底；更严格可用条件 `updateMany` 原子抢锁代替"先查后写"。验签为待补项（见诚实边界） |
| 监控 SDK 为什么不直接用 Sentry？ | 学习目的自研全链路（采集→上报→建模→存储）；量级小无需采样，后续可加批量/离线缓存 |
| Monorepo 为什么双层？ | 外层 pnpm workspace 管 web/tracker/common，内层 Nest monorepo 管 server/ai + libs/shared，各用各的生态原生方案，避免强行统一 |

---

## 六、可量化的规模数据（支撑描述）

- 前后端约 150+ 源码文件，独立完成从零搭建到全链路上线
- 11 张数据库表，覆盖用户体系、单词学习、支付订单、AI 会话、埋点统计五大业务域
- 安全措施覆盖 8 个防护层次（认证/密码/存储/限流/输入/头与跨域/XSS/数据层），产出审计与修复报告 3 份
- 监控 SDK 采集 5 类数据维度、5 项核心 Web 指标（FP/FCP/LCP/INP/CLS）

---

## 七、诚实边界（避免面试翻车的口径）

- **间隔重复算法（SM-2 等）**：单词学习闭环（倒计时记忆 → 模糊考验 → 拼写校验 → 掌握标记过滤）已实现；星级自评与间隔重复是规划中的迭代项，不要写成已完成
- **支付验签**：回调验签是已知待补项，被追问时主动承认并说明方案（`alipaySdk.checkNotifySign` + out_trade_no 幂等），体现风险意识比假装完整更加分
- **Tracker 后台看板**：SDK 与数据层已就绪，可视化看板未做
- **测试**：配置了 Jest 但覆盖率低，如被问测试策略，讲 planned 方案（支付/认证核心链路优先）而不是回避
