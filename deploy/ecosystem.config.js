// pm2 进程定义 —— 部署形态的唯一来源
//
// 在这之前，cwd / script / 实例数 / cluster 模式这些信息只存在于服务器的
// /root/.pm2/dump.pm2 里：服务器重建即丢失，改了什么也没有 diff 可看。
// 放进仓库后，pm2 的运行时定义也随代码一起被版本管理。
//
// 用法（在服务器上、仓库根目录执行）：
//   pm2 startOrReload deploy/ecosystem.config.js
//   pm2 save

const path = require("path");

// 由本文件的位置推导后端目录，因此仓库整体搬移（例如换盘、换路径）不需要改这里
const serverDir = path.resolve(__dirname, "..", "server");

// nest-cli.json 里 root="apps/server"、sourceRoot="apps/server/src"，配上 outDir="./dist"，
// 最终入口是三层嵌套的路径。不要按直觉写成 dist/main.js —— server/package.json 里
// 原来的 start:prod 就是这么写的，指向一个不存在的文件。
const serverEntry = path.join(
  serverDir,
  "dist/apps/server/apps/server/src/main.js",
);

module.exports = {
  apps: [
    {
      // 与旧进程名 main 不同。一次性迁移时 bootstrap.sh 会先 pm2 delete main 释放 3000 端口
      name: "english-server",

      // cwd 必须指向 server/：ConfigModule.forRoot 的 envFilePath 是相对路径 ".env"，
      // 以进程 cwd 解析。cwd 写错会表现为"配置读到了但全是 undefined"
      cwd: serverDir,
      script: serverEntry,

      instances: 2,
      exec_mode: "cluster", // pm2 reload 逐个替换 worker，可实现零停机

      // Nest 启动时要连 Postgres / Redis / MinIO，默认 3s 的 listen_timeout 常常不够，
      // 不够时 pm2 会认为启动失败并反复重启，表现为发布后接口短暂 502
      listen_timeout: 20000,
      max_memory_restart: "600M",

      env: {
        NODE_ENV: "production",
      },

      merge_logs: true, // 两个 worker 写同一个日志文件，便于按时间顺序排查
      time: true, // 日志行带时间戳
    },

    // AI 服务（server/apps/ai，监听 3001），nginx 的 /ai/ 反代指向它。
    //
    // 构建：pnpm --filter @en/server run build:ai（deploy.sh / bootstrap.sh 里已经包含这一步）
    // 入口和 server 一样是嵌套路径，产物在 server/dist/apps/ai/apps/ai/src/main.js
    //
    // 用 fork 单实例而不是 cluster：它注册了一个 BullMQ repeatable job（每天 00:00 的单词
    // 记忆报告），多实例会让同一个定时任务在每个实例上都注册一遍
    //
    // 注意：这个进程一启动，每天凌晨就会给「开了定时任务 + 留了邮箱 + 当天背过单词」的用户
    // 跑 LLM 生成报告并真实发信（DigestService.onModuleInit 注册的定时任务）。
    // 想临时停掉，`pm2 stop english-ai` 只能撑到下一次发布——deploy.sh 的 startOrReload
    // 会把它重新拉起。要长期停发信就改代码把 DigestModule 从 AiModule 摘掉。
    {
      name: "english-ai",
      cwd: serverDir,
      script: path.join(serverDir, "dist/apps/ai/apps/ai/src/main.js"),
      instances: 1,
      exec_mode: "fork",
      listen_timeout: 20000,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production" },
      merge_logs: true,
      time: true,
    },
  ],
};
