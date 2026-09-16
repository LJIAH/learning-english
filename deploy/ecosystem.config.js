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

    // AI 服务（server/apps/ai，监听 3001）当前在生产上没有运行：
    // nginx 的 /ai/ 反代指向 127.0.0.1:3001，但该端口没有监听，所以 /ai/ 实际是 502。
    // 需要启用时先在服务器执行 `pnpm --filter @en/server exec nest build ai`
    // （构建 AI 应用，产物在 server/dist/apps/ai/），再取消下面这段的注释，
    // 然后 `pm2 startOrReload deploy/ecosystem.config.js --only english-ai && pm2 save`。
    //
    // {
    //   name: "english-ai",
    //   cwd: serverDir,
    //   script: path.join(serverDir, "dist/apps/ai/apps/ai/src/main.js"),
    //   instances: 1,
    //   exec_mode: "fork",
    //   listen_timeout: 20000,
    //   env: { NODE_ENV: "production" },
    //   merge_logs: true,
    //   time: true,
    // },
  ],
};
