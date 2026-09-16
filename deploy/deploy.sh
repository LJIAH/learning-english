#!/usr/bin/env bash
#
# 生产发布脚本（在服务器上执行）
#
#   bash deploy/deploy.sh             正常发布：拉取 -> 安装 -> 构建 -> 同步前端 -> 重载 pm2 -> 自检
#   bash deploy/deploy.sh --rollback  回滚到上一次发布前的提交
#   bash deploy/deploy.sh --help
#
# 前提（与 deploy/README.md 的拓扑一致）：
#   - 服务器上的代码是 git clone，禁止手改，所有改动都从 git 来
#   - web 根目录只放静态构建产物，后端代码在 web 根之外
#   - 后端在服务器上构建（与生产同构），不从 Windows 传 dist 或 node_modules 过去

set -euo pipefail

# ---------- 可覆盖配置（用环境变量注入，不必改本文件） ----------
REPO_DIR="${REPO_DIR:-/www/wwwroot/english-code}"      # 代码克隆目录，必须在 web 根之外
BRANCH="${BRANCH:-master}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/english.kevy.top}"  # nginx root，只放静态产物
PM2_APP="${PM2_APP:-english-server}"
WEB_OWNER="${WEB_OWNER:-www:www}"                      # 静态文件属主；置空则不修改属主
# 用来校验前端产物里确实注入了 .env.production 的域名，防止漏配造成静默故障
EXPECT_BUNDLE_HOST="${EXPECT_BUNDLE_HOST:-english.kevy.top}"

STATE_DIR="$REPO_DIR/.deploy-state"

export REPO_DIR WEB_ROOT

# ---------- 输出 ----------
log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[error] %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
用法:
  bash deploy/deploy.sh             发布（拉取 -> 安装 -> 构建 -> 同步前端 -> 重载 pm2 -> 自检）
  bash deploy/deploy.sh --rollback  回滚到上一次发布前的提交
  bash deploy/deploy.sh --help

可用环境变量覆盖:
  REPO_DIR  BRANCH  WEB_ROOT  PM2_APP  WEB_OWNER  EXPECT_BUNDLE_HOST
USAGE
}

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "缺少必需命令: $1"; }

preflight() {
  log "前置检查"
  local c
  for c in git pnpm pm2 rsync curl; do require_cmd "$c"; done
  [ -d "$REPO_DIR/.git" ] || die "$REPO_DIR 不是 git 仓库。首次部署请先执行 deploy/bootstrap.sh"
  [ -f "$REPO_DIR/server/.env" ] || die "$REPO_DIR/server/.env 不存在，后端启动会缺配置（可从旧站点迁移，见 deploy/README.md）"
  [ -d "$WEB_ROOT" ] || die "web 根目录不存在: $WEB_ROOT"
  # 旧进程还在跑就会占着 3000 端口，新进程会 EADDRINUSE，这里提前拦下并给出处置命令
  if pm2 describe main >/dev/null 2>&1; then
    die "检测到旧 pm2 进程 main 仍在运行，它会占用 3000 端口。请先执行：pm2 delete main && pm2 save"
  fi
}

pull_code() {
  log "拉取代码"
  cd "$REPO_DIR"
  # 服务器上出现未提交改动，说明有人手改了源码，这正是本方案要消除的情况，直接拒绝发布
  if [ -n "$(git status --porcelain)" ]; then
    git status --short | head -20 >&2
    die "工作区有未提交改动，拒绝发布。请先 git stash，或用 git checkout -- <file> 还原"
  fi
  mkdir -p "$STATE_DIR"
  # 记录当前提交，供 --rollback 使用
  git rev-parse HEAD > "$STATE_DIR/previous-sha"
  git fetch --prune origin
  git checkout "$BRANCH"
  # --ff-only：本地若有分叉（不该发生）宁可失败，也不要产生合并提交
  git merge --ff-only "origin/$BRANCH"
  log "目标提交: $(git rev-parse --short HEAD)  $(git log -1 --pretty=%s)"
}

install_build() {
  log "安装依赖"
  cd "$REPO_DIR"
  pnpm install --frozen-lockfile

  # Prisma Client 生成到 server/libs/shared/src/generated/prisma，该目录被 .gitignore 忽略，
  # 且项目没有 postinstall 钩子，所以每次发布都要显式生成，否则编译找不到 @/generated/prisma
  log "生成 Prisma Client"
  pnpm --filter @en/server run prisma:generate

  # 这里有真实的构建顺序依赖：apps/web 的 App.vue import 了 @en/tracker，
  # 而 @en/tracker 的 package.json exports 指向 dist/，所以必须先构建 tracker 再构建 web
  log "构建 @en/tracker"
  pnpm --filter @en/tracker build
  log "构建 @en/web"
  pnpm --filter @en/web build
  log "构建 @en/server"
  pnpm --filter @en/server build
}

assert_artifacts() {
  log "校验构建产物"
  local entry="$REPO_DIR/server/dist/apps/server/apps/server/src/main.js"
  local web_index="$REPO_DIR/apps/web/dist/index.html"
  [ -f "$entry" ] || die "后端入口不存在: $entry（构建失败，或 nest-cli 输出的嵌套路径变了）"
  [ -f "$web_index" ] || die "前端产物不存在: $web_index"

  # 前端把 VITE_UPLOAD_URL / VITE_SOCKET_URL 编译进 bundle，取值来自 apps/web/.env.production。
  # 该文件一旦缺失，构建照样成功，但线上头像/课程图片和 Socket.IO 会连不上——属于静默故障。
  # 这里用"产物中必须出现生产域名"来兜住它。
  if ! grep -rqs "$EXPECT_BUNDLE_HOST" "$REPO_DIR/apps/web/dist/assets"; then
    die "前端产物里找不到 '$EXPECT_BUNDLE_HOST'，多半是 apps/web/.env.production 缺失（VITE_UPLOAD_URL/VITE_SOCKET_URL 未注入）"
  fi
  log "产物校验通过"
}

sync_web() {
  log "同步前端产物到 web 根"
  local args=(-a --delete --human-readable)
  # .user.ini 是宝塔生成的反跨站配置文件，不属于构建产物，必须排除，否则 --delete 会删掉它
  args+=(--exclude='.user.ini')
  args+=(--exclude='.htaccess')
  args+=(--exclude='.well-known/')
  if [ "$(id -u)" = "0" ] && [ -n "$WEB_OWNER" ]; then
    args+=(--chown="$WEB_OWNER")
  fi
  rsync "${args[@]}" "$REPO_DIR/apps/web/dist/" "$WEB_ROOT/"
}

assert_layout() {
  log "校验 web 根目录布局"
  local bad=()
  local f
  for f in server packages node_modules package.json pnpm-lock.yaml pnpm-workspace.yaml .git .env; do
    [ -e "$WEB_ROOT/$f" ] && bad+=("$f")
  done
  if [ "${#bad[@]}" -gt 0 ]; then
    die "web 根目录里出现了非静态内容: ${bad[*]}。web 根只应包含构建产物，请把它们移出 $WEB_ROOT"
  fi
  log "布局校验通过：web 根内只有静态产物"
}

reload_pm2() {
  log "重载 pm2"
  cd "$REPO_DIR"
  # cluster 模式下 startOrReload 会逐个替换 worker：先起新的，就绪后再杀旧的，实现零停机。
  # 应用自己的 .env 是 Nest 在运行时读取的文件，所以改了 .env 只需 reload，
  # 不需要 --update-env（那是给 pm2 保存的环境变量用的）
  pm2 startOrReload deploy/ecosystem.config.js
  pm2 save
}

do_deploy() {
  preflight
  pull_code
  install_build
  assert_artifacts
  sync_web
  assert_layout
  reload_pm2
  log "发布完成: $(cd "$REPO_DIR" && git rev-parse --short HEAD)"
  bash "$REPO_DIR/deploy/verify.sh"
  printf '\n完成。日志查看: pm2 logs %s\n' "$PM2_APP"
}

do_rollback() {
  preflight
  [ -f "$STATE_DIR/previous-sha" ] || die "没有回滚记录（$STATE_DIR/previous-sha 不存在）。至少成功发布过一次才能回滚"
  local sha
  sha="$(cat "$STATE_DIR/previous-sha")"
  cd "$REPO_DIR"
  log "回滚到 $sha  $(git log -1 --pretty=%s "$sha")"
  git fetch --prune origin
  # 回滚需要能构建旧代码；checkout 会一并切回当时的 pnpm-lock.yaml，所以 --frozen-lockfile 依旧成立
  git checkout --detach "$sha"
  warn "已切到 detached HEAD。下次正常执行 deploy.sh 时会自动切回 $BRANCH"
  install_build
  assert_artifacts
  sync_web
  assert_layout
  reload_pm2
  log "回滚完成"
  bash "$REPO_DIR/deploy/verify.sh"
}

case "${1:-}" in
  ""|--deploy) do_deploy ;;
  --rollback)  do_rollback ;;
  -h|--help)   usage ;;
  *)           usage; die "未知参数: $1" ;;
esac
