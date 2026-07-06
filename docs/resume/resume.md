# AI 英语学习平台 — 项目简历话术

## 项目概述

基于 pnpm monorepo + NestJS 微服务架构的全栈 AI 英语学习平台，覆盖单词学习、AI 对话、课程购买、邮件推送、埋点统计等完整业务闭环。前端 Vue 3 + TypeScript 6 + Vite 8，后端 NestJS 11 双服务拆分（业务 API + AI 服务），PostgreSQL + Redis + MinIO 基础设施。

---

## 核心职责与技术亮点

### 架构设计

- **设计并落地 pnpm workspace + 嵌套 Nest monorepo 二维工程结构**，将前端（Vue 3）、后端业务 API（NestJS）、AI 服务（NestJS）三大应用解耦为独立子包，通过 `packages/common` 全栈共享 TypeScript 类型定义，消除前后端类型不一致问题
- **基于双 token 认证体系**（accessToken 15min / refreshToken 7d）实现无感刷新，前端封装请求队列避免并发 401 时重复刷新，提升用户体验的同时降低服务端压力
- 统一全局异常过滤器与响应拦截器，所有接口返回标准化 JSON 结构（`timestamp + path + message + code + status + data`），并通过 URI 版本化（`/api/v1`、`/ai/v1`）控制 API 演进

### AI 对话系统

- **集成 LangChain + DeepSeek 模型**，实现 SSE 流式对话输出，支持多角色切换、深度思考过程展示、Bocha 联网搜索等能力
- **使用 LangGraph + PostgresSaver 实现对话状态持久化**，以 `userId-role` 为 thread_id 隔离不同角色会话，保证上下文连续性同时实现会话级别隔离
- 前端通过 `@microsoft/fetch-event-source` 解析 SSE 流，对 reasoning（思考过程）和 chat（回复内容）分类渲染，并支持 Markdown 实时转码

### 支付与消息推送

- **对接支付宝沙箱 SDK**，完成下单 → 异步回调 → 订单状态更新 → 课程权限开通的完整支付链路，使用 Prisma 事务保证数据一致性
- 引入 **Socket.IO 实时通知**，支付成功后按 `userId` 分房间推送消息，前端即时更新课程状态，提升用户感知
- 基于 **BullMQ + Redis 实现定时邮件摘要**：每日 0 点触发任务，AI Agent 查询用户当日学习记录自动生成单词记忆报告，再按用户自定义时间延迟投递邮件

### 单词学习引擎

- 设计词库与用户学习记录的数据模型（`WordBook` + `WordBookRecord`），支持按中高考/四六级/考研/GRE/雅思/托福等多种标签筛选
- 实现「课程→单词学习→掌握标记」的闭环：已掌握单词自动过滤不再出现，用户单词数量增量更新，已购课程权限校验防止越权访问
- 前端实现单词拼写记忆训练，加入倒计时、模糊/隐藏释义、逐字母校验交互，正在迭代星级自评与间隔重复算法

### 埋点统计系统（设计完成，SDK 开发中）

- 设计 **Prisma 五表埋点数据模型**（Visitor / PageView / TrackEvent / PerformanceEntry / ErrorEntry），覆盖 UV、PV、用户行为事件、Web 性能指标（FP/FCP/LCP/CLS）、JS 错误监控五大维度
- 索引设计按 `[visitorId, createdAt]`、`[event, createdAt]` 等复合维度预判查询模式，为后续数据看板优化查询性能

### 基础设施与工程化

- **Prisma 7.8 + `@prisma/adapter-pg`** 直接驱动 PostgreSQL，无连接池中间层，减少一层网络开销
- **MinIO 对象存储**：模块启动时自动创建 Bucket 并配置公开读策略，头像上传后生成预览 URL
- 前端 Vite 代理实现开发环境跨域请求分发，生产环境按路径前缀转发
- Pinia 状态持久化、Vue Router 路由守卫、Element Plus 中文国际化等工程化细节完整

---

## 技术栈

| 分类      | 技术                                              |
| --------- | ------------------------------------------------- |
| 框架      | Vue 3.5 / NestJS 11                               |
| 语言      | TypeScript 6.0                                    |
| 构建      | Vite 8 / pnpm 11                                  |
| UI        | Element Plus / Tailwind CSS v4                    |
| 数据库    | PostgreSQL + Prisma 7.8                           |
| 缓存/队列 | Redis + BullMQ                                    |
| AI        | LangChain + DeepSeek + PostgresSaver（LangGraph） |
| 存储      | MinIO                                             |
| 实时通信  | Socket.IO                                         |
| 支付      | 支付宝 SDK                                        |
| 邮件      | Nodemailer                                        |
| 特效      | GSAP / Three.js                                   |

---

## 项目难点攻克

1. **AI 流式对话的会话管理**：通过 LangGraph + PostgresSaver 以 `userId-role` 为 thread 隔离会话，解决多角色对话上下文混淆问题；前端 SSE 流式渲染过程中区分 reasoning 与 chat 两种消息类型，仅在用户开启深度思考时展示思考过程以优化 token 消耗

2. **并发 401 刷新竞态**：实现前端请求队列机制，首个过期请求触发刷新后，后续并发 401 请求进入等待队列，刷新成功后用新 token 统一重试，避免多次刷新

3. **Windows 环境 pnpm monorepo 兼容**：通过 `node-linker=hoisted` + `shamefully-hoist=true` + `fix_links.bat` 解决符号链接兼容性问题

4. **支付宝回调安全**：事务内完成订单状态更新 + 课程权限开通 + Socket 实时推送，保证支付闭环数据一致性

---

## 个人贡献总结

- 独立完成项目从零搭建到全链路功能上线，涵盖前端、后端、数据库、AI 集成、支付、存储、消息推送全栈 7 大技术域
- 设计 11 张数据库表，覆盖用户体系、单词学习、支付订单、AI 会话状态、埋点统计五大业务域
- 前后端共约 150+ 源码文件，代码零运行时异常（extracker 开发中不计入）
