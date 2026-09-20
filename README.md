# Learning English

AI 驱动的英语学习平台，pnpm monorepo：Vue 3 前端 + NestJS 双后端（业务服务 `:3000`、AI 服务 `:3001`）+ 自研埋点 SDK + 共享类型/配置包。生产域名 [english.kevy.top](https://english.kevy.top)。

## 功能

- **AI 对话**：5 种模式（口语教练 / 词典 / 应试写作 / 外刊精读 / 沉浸式），SSE 流式输出、深度思考（reasoning）折叠面板、博查联网搜索、语音输入、Markdown 渲染（marked + DOMPurify 防 XSS）
- **背单词**：8 类考试词库（高考 / 中考 / GRE / 托福 / 雅思 / 四级 / 六级 / 考研）筛选与发音，拼写练习（20 秒倒计时、逐字校验），掌握后累加打卡
- **课程与购买**：精选课程 / 我的课程，支付宝沙箱下单，Socket.IO 实时推送支付成功
- **用户中心**：注册登录（JWT 双 token：access 15m + refresh 7d httpOnly cookie 静默续期）、头像上传（MinIO）、每日单词报告邮件（BullMQ 定时任务 + LLM 生成）
- **埋点监控**：UV（FingerprintJS 指纹）、PV、全局点击事件、JS/Promise 错误、Web Vitals（FP/FCP/LCP/INP/CLS）

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3.5、Vue Router 5、Pinia 3、Element Plus、Tailwind CSS 4、Vite 8、Three.js、GSAP |
| 后端 | NestJS 11、Prisma 7 + PostgreSQL、Redis + BullMQ、Socket.IO、JWT、helmet + Throttler |
| AI | LangChain + DeepSeek（createAgent）、LangGraph PostgresSaver（按 `userId-role` 隔离会话检查点）、博查联网搜索 |
| 基础设施 | MinIO（对象存储）、支付宝沙箱、QQ SMTP（邮件）、nginx + pm2（生产） |
| 埋点 SDK | FingerprintJS、ua-parser-js、web-vitals（Vite lib 模式打包） |
| 工程 | pnpm workspace、TypeScript、ESLint + Prettier、Vitest + jsdom（埋点 SDK 单测）、Playwright（E2E） |

## 目录结构

```
.
├── apps/
│   ├── web/                 # @en/web 前端（Vue 3 + Vite），dev 端口 8080
│   └── tracker/             # @en/tracker 埋点 SDK（Vite lib 模式，产物 dist/；Vitest 单测）
├── packages/
│   ├── common/              # @en/common 共享 TS 类型（chat/course/learn/pay/tracker/user/word，直接源码导出）
│   └── config/              # @en/config 端口常量（web 8080 / server 3000 / ai 3001）
├── server/                  # @en/server NestJS monorepo
│   ├── apps/server/         # 业务后端 :3000，对外 /api/v1（auth/user/word-book/course/learn/pay/socket/tracker）
│   ├── apps/ai/             # AI 服务 :3001，对外 /ai/v1（chat/prompt/digest/llm）
│   ├── libs/shared/         # 公共库：Prisma、MinIO、Email、Pay、AuthGuard、统一响应/拦截器
│   └── prisma/              # schema、migrations、seed.ts、课程封面图
└── deploy/                  # pm2 + nginx 部署脚本（bootstrap/deploy/verify）与详细文档
```

## 快速开始

### 环境要求

- Node.js >= 22（`marked@18` 依赖 `require(esm)`；生产实测 Node 24.18）
- pnpm 11（`packageManager` 固定为 `pnpm@11.10.0`，corepack 会自动切换）
- PostgreSQL：两个库，业务库 `english` + LangGraph 检查点库 `langchain`
- Redis（BullMQ 队列）、MinIO（头像与课程封面）
- 可选凭据：DeepSeek、博查、支付宝沙箱、SMTP（缺失时对应功能不可用）

### 安装

```bash
pnpm install
```

### 配置环境变量

`server` 下的环境变量文件**不入库**，需要自行创建，且 Prisma CLI 与 Nest 运行时读取的文件不同：

| 文件 | 使用方 |
| --- | --- |
| `server/.env.dev` | Nest 运行时（`NODE_ENV` 非 `production` 时加载） |
| `server/.env` | 生产运行时（`NODE_ENV=production`）以及 Prisma CLI（generate / migrate / seed） |

本地开发让两者内容一致即可，关键变量：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` / `AI_DATABASE_URL` | 业务库 / LangGraph 检查点库连接串 |
| `SECRET_KEY` | JWT 签名密钥 |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_ENDPOINT` / `MINIO_PORT` / `MINIO_USE_SSL` / `MINIO_BUCKET` | MinIO 连接与桶名 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_API_MODEL` | DeepSeek 对话模型 |
| `BOCHA_SEARCH_URL` / `BOCHA_API_KEY` | 博查联网搜索 |
| `ALIPAY_APP_ID` / `ALIPAY_GATEWAY` / `ALIPAY_PUBLIC_KEY` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_NOTIFY_URL` | 支付宝沙箱 |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASSWORD` / `EMAIL_FROM` / `EMAIL_USE_SSL` | 邮件服务（QQ SMTP） |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接 |
| `CORS_ORIGIN` | 生产环境 CORS 白名单（逗号分隔）；开发默认放行 8080 / 5173 |

前端 `apps/web/.env.development`、`.env.production` 已入库（只有 `VITE_*` 构建期公开常量），通常无需改动。

### 初始化数据库

```bash
pnpm --filter @en/server prisma:generate        # 生成 Prisma Client
pnpm --filter @en/server prisma:migrate         # 应用迁移（prisma migrate dev）
pnpm --filter @en/server exec prisma db seed    # 种子数据：8 类课程 + 上传封面到 MinIO 的 course 桶
```

### 启动

首次启动前需构建一次埋点 SDK：`apps/web` 通过 package 入口依赖 `@en/tracker` 的 `dist` 产物，而 `dist/` 不入库。

```bash
pnpm --filter @en/tracker build
```

```bash
pnpm all       # 一键启动 web + server + ai
# 或者分开启动
pnpm web       # 前端 http://localhost:8080（vite 代理 /api → 3000、/ai → 3001）
pnpm server    # 业务后端 http://localhost:3000
pnpm ai        # AI 服务 http://localhost:3001
```

其他脚本：

```bash
pnpm tracker   # 埋点 SDK dev
pnpm minio     # 启动仓库外同级目录 ../minio/start.cmd
pnpm natapp    # 启动 ../natapp/run_natapp.bat（内网穿透，供支付宝异步回调访问本机）
pnpm ngrok     # 启动 ../ngrok/start.cmd（natapp 的替代方案）
pnpm dev       # 一键：minio + natapp + all
pnpm test:unit # 埋点 SDK 单元测试（Vitest + jsdom，用例与源码同目录）
```

> `minio` / `natapp` / `ngrok` 依赖仓库**同级目录**下已存在的对应工具目录。

### 快捷别名（Git Bash）

已配置 `p` = `pnpm`、`pr` = `pnpm run`：

```bash
p all          # 等价于 pnpm run all（一键启动全部）
pr web         # 等价于 pnpm run web
pr server      # 等价于 pnpm run server
pr ai          # 等价于 pnpm run ai
```

## 服务与端口

| 服务 | 端口 | 对外前缀 | 说明 |
| --- | --- | --- | --- |
| web | 8080 | — | Vite dev server，代理 `/api`、`/ai` |
| server | 3000 | `/api/v1` | 业务接口 + `/socket.io` |
| ai | 3001 | `/ai/v1` | SSE 流式对话、会话历史、提示词列表 |
| MinIO | 9000 | — | 头像（`avatar` 桶）、课程封面（`course` 桶） |
| tracker dev | 5173 | — | Vite 默认端口，已在后端 CORS 白名单内 |

## 部署

生产由 pm2 托管（`english-server` cluster ×2 + `english-ai` fork ×1），nginx 托管静态产物并反代接口。脚本在 `deploy/`：

```bash
bash deploy/bootstrap.sh <仓库地址> --yes   # 首次初始化（只跑一次）
bash deploy/deploy.sh --deploy              # 日常发布：拉代码 + 构建 + 同步 + reload + 自检
bash deploy/deploy.sh --rollback            # 回滚代码（不回滚数据库）
bash deploy/verify.sh                       # 发布后自检（只读）
```

完整拓扑、nginx 配置、故障排查与约定见 [`deploy/README.md`](deploy/README.md)。

## 相关文档

| 文档 | 内容 |
| --- | --- |
| [`deploy/README.md`](deploy/README.md) | 部署拓扑、pm2 / nginx 配置、发布与回滚、故障排查、已知问题 |
| [`server/prisma/schema.design.md`](server/prisma/schema.design.md) | 数据模型关系与索引设计说明 |
| [`server/apps/server/src/main.md`](server/apps/server/src/main.md) | 后端入口加固说明（trust proxy、httpOnly cookie、CORS） |
| [`apps/web/src/hooks/useThreeScene.md`](apps/web/src/hooks/useThreeScene.md) | Three.js 场景 Composable 用法 |
| [`apps/web/src/directives/focus/focus.md`](apps/web/src/directives/focus/focus.md) | `v-focus` 指令用法 |
| [`apps/tracker/src/report/README.md`](apps/tracker/src/report/README.md) | 埋点上报方式对比（sendBeacon vs fetch keepalive） |

> `server/README.md` 与 `apps/web/README.md` 是框架脚手架自带的模板文档，非项目文档。

## 注意事项

- `.env*` 一律不入库；`apps/web/.env.production`、`apps/web/.env.development` 是刻意的例外——`VITE_*` 会被 vite 内联进产物，属公开信息，不提交会导致上传、头像、课程图、Socket 全部失效
- 构建顺序固定 `tracker → web → server → ai`（web 依赖 tracker 的 dist 产物）
- `marked@18` 需要 Node >= 22，降到 Node 20 会在启动时直接报错
- 改完 nginx、`.env`、pm2 配置后留一份带时间戳的备份，出问题能立刻回退
