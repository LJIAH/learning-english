#!/usr/bin/env bash
#
# 生产发布脚本（在服务器上执行）
#
#   bash deploy/deploy.sh             正常发布：拉取 -> 安装 -> 构建 -> 应用迁移 -> 同步前端 -> 重载 pm2 -> 自检
#                                     不带 --web 时沿用线上当前的前端版本
#   bash deploy/deploy.sh --web react 发布 React 版前端（Vue / React 可随时切换，映射见下方变体表）
#   bash deploy/deploy.sh --print-plan --web react   只打印本次解析结果，不触碰服务器
#   bash deploy/deploy.sh --rollback  回滚到上一次发布前的提交（连同前端版本一起回退）
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
WEB_VARIANT="${WEB_VARIANT:-}"                              # 前端变体；空 = 沿用线上当前版本（首次默认 vue）

STATE_DIR="$REPO_DIR/.deploy-state"

export REPO_DIR WEB_ROOT

# ---------- 前端变体（Vue / React） ----------
# 线上同一个 web 根同一时刻只能服务一份静态产物，所以发布时显式选择构建哪个前端。
# 下面这张表是唯一需要维护的地方：变体 -> 包名 / 产物目录 / index.html 挂载点。
# 刻意不含分支信息 —— 两个前端都随当前部署分支（BRANCH，默认 master）一起发布。
WEB_VARIANTS="vue react"

is_valid_variant() { case "$1" in vue|react) return 0 ;; *) return 1 ;; esac; }

use_variant() { # $1 = 变体名，设置本次发布的 WEB_VARIANT_NAME / WEB_PKG / WEB_DIR / WEB_MOUNT
  case "$1" in
    vue)   WEB_PKG='@en/web';       WEB_DIR='apps/web';       WEB_MOUNT='#app'  ;;
    react) WEB_PKG='@en/web-react'; WEB_DIR='apps/web-react'; WEB_MOUNT='#root' ;;
    *)     die "未知前端变体: $1（可选: $WEB_VARIANTS）" ;;
  esac
  WEB_VARIANT_NAME="$1"
}

live_web_variant() { # 线上当前变体：由同步成功后的状态文件记录；没有记录时打印空
  [ -f "$STATE_DIR/web-variant" ] || return 0
  tr -d '[:space:]' < "$STATE_DIR/web-variant"
}

resolve_web_variant() { # 优先级：--web / WEB_VARIANT > 线上当前版本 > vue
  local want="${WEB_VARIANT:-}"
  if [ -z "$want" ]; then
    want="$(live_web_variant)"
    if [ -n "$want" ] && ! is_valid_variant "$want"; then
      warn "状态文件 $STATE_DIR/web-variant 内容无法识别，按首次发布处理（vue）"
      want=''
    fi
  fi
  [ -n "$want" ] || want='vue'
  use_variant "$want"
}

# ---------- 输出 ----------
log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[error] %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
用法:
  bash deploy/deploy.sh [--web vue|react] [--branch <分支>]
  bash deploy/deploy.sh --print-plan [--web vue|react]
  bash deploy/deploy.sh --rollback
  bash deploy/deploy.sh --help

前端变体（同一时刻线上只有一版，可随时切回）:
  vue    包 @en/web       产物 apps/web/dist       挂载点 #app
  react  包 @en/web-react 产物 apps/web-react/dist 挂载点 #root

说明:
  * 不带 --web 时沿用线上当前版本（首次发布默认 vue），避免忘带参数而误切版本
  * 两个变体都随同一个 BRANCH（默认 master）发布，与分支无关
  * --print-plan 只打印解析结果，不触碰服务器

可用环境变量覆盖:
  REPO_DIR  BRANCH  WEB_VARIANT  WEB_ROOT  PM2_APP  WEB_OWNER  EXPECT_BUNDLE_HOST
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
  # 服务器上出现未提交改动，说明有人手改了源码，这正是本方案要消除的情况，直接拒绝发布。
  # 例外：.deploy-state/ 是本脚本自己写的上一版提交记录，属于状态而不是源码。
  # 它已在 .gitignore 里，这里再过滤一次 —— 否则在老 checkout（还没有那条 ignore 规则）
  # 上跑第二次发布时，脚本会被自己的产物拦下。
  local dirty
  dirty="$(git status --porcelain | grep -v '^?? \.deploy-state/$' || true)"
  if [ -n "$dirty" ]; then
    printf '%s\n' "$dirty" | head -20 >&2
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
  # 变体要的前端目录必须在当前提交里存在，否则会出现「构建成功但 rsync 了空目录」
  [ -d "$REPO_DIR/$WEB_DIR" ] || die "提交 $(git rev-parse --short HEAD) 里没有 $WEB_DIR，无法发布变体 $WEB_VARIANT_NAME。确认该前端已合入 $BRANCH"
}

install_build() {
  log "安装依赖"
  cd "$REPO_DIR"
  pnpm install --frozen-lockfile

  # Prisma Client 生成到 server/libs/shared/src/generated/prisma，该目录被 .gitignore 忽略，
  # 且项目没有 postinstall 钩子，所以每次发布都要显式生成，否则编译找不到 @/generated/prisma
  log "生成 Prisma Client"
  pnpm --filter @en/server run prisma:generate

  # 这里有真实的构建顺序依赖：前端 import 了 @en/tracker，
  # 而 @en/tracker 的 package.json exports 指向 dist/，所以必须先构建 tracker 再构建前端
  log "构建 @en/tracker"
  pnpm --filter @en/tracker build
  log "构建前端 变体=$WEB_VARIANT_NAME 包=$WEB_PKG"
  pnpm --filter "$WEB_PKG" build
  log "构建 @en/server"
  pnpm --filter @en/server build

  # apps/ai 是同一个 nest 项目里的第二个应用，入口同样是嵌套路径。
  # 漏掉这一步不会报错：dist/apps/ai 会一直停留在上一次成功构建的版本，
  # 表现为「AI 发布成功但跑的是旧代码」。
  log "构建 @en/ai"
  pnpm --filter @en/server run build:ai
}

assert_artifacts() {
  log "校验构建产物"
  local entry="$REPO_DIR/server/dist/apps/server/apps/server/src/main.js"
  local ai_entry="$REPO_DIR/server/dist/apps/ai/apps/ai/src/main.js"
  local web_index="$REPO_DIR/$WEB_DIR/dist/index.html"
  [ -f "$entry" ] || die "后端入口不存在: $entry（构建失败，或 nest-cli 输出的嵌套路径变了）"
  [ -f "$ai_entry" ] || die "AI 应用入口不存在: $ai_entry（build:ai 没跑或失败，ecosystem.config.js 里的 english-ai 会起不来）"
  [ -f "$web_index" ] || die "前端产物不存在: $web_index（变体 $WEB_VARIANT_NAME）"

  # 前端把 VITE_UPLOAD_URL / VITE_SOCKET_URL 编译进 bundle，取值来自 $WEB_DIR/.env.production。
  # 该文件一旦缺失，构建照样成功，但线上头像/课程图片和 Socket.IO 会连不上——属于静默故障。
  # 这里用"产物中必须出现生产域名"来兜住它。
  if ! grep -rqs "$EXPECT_BUNDLE_HOST" "$REPO_DIR/$WEB_DIR/dist/assets"; then
    die "前端产物里找不到 '$EXPECT_BUNDLE_HOST'，多半是 $WEB_DIR/.env.production 缺失（VITE_UPLOAD_URL/VITE_SOCKET_URL 未注入）"
  fi
  log "产物校验通过（前端变体: $WEB_VARIANT_NAME）"
}

migrate_db() {
  log "应用数据库迁移"
  cd "$REPO_DIR"
  # prisma migrate deploy：只把 prisma/migrations 里尚未执行过的迁移按顺序应用，
  # 不生成新迁移、不重置数据；没有新迁移时是 no-op。
  #
  # 位置是刻意的 —— 排在产物校验之后、同步前端和重载之前：
  #   * 构建或产物校验失败时，数据库和线上都还没被动过，今天的失败语义不变
  #   * 迁移失败立刻退出，此时前端也还没同步，不会出现「新前端 + 旧后端」这种最难查的组合
  #   * 迁移成功后只剩同步前端和重载，库比代码新的窗口只有几秒
  pnpm --filter @en/server exec prisma migrate deploy \
    || die "数据库迁移失败，已中止发布（前端未同步、pm2 未重载，线上仍是旧版本）"
}

sync_web() {
  log "同步前端产物到 web 根（变体: $WEB_VARIANT_NAME）"
  local args=(-a --delete --human-readable)
  # .user.ini 是宝塔生成的反跨站配置文件，不属于构建产物，必须排除，否则 --delete 会删掉它
  args+=(--exclude='.user.ini')
  args+=(--exclude='.htaccess')
  args+=(--exclude='.well-known/')
  if [ "$(id -u)" = "0" ] && [ -n "$WEB_OWNER" ]; then
    args+=(--chown="$WEB_OWNER")
  fi
  rsync "${args[@]}" "$REPO_DIR/$WEB_DIR/dist/" "$WEB_ROOT/"
}

# 状态文件描述「线上现在跑的是哪版」和「上一版是什么」，两者都在 rsync 成功之后才写：
# 提前写会在同步失败时留下错误记录，--rollback 就会挑错前端版本去重建。
record_web_state() {
  mkdir -p "$STATE_DIR"
  local prev
  prev="$(live_web_variant)"
  [ -n "$prev" ] || prev="$WEB_VARIANT_NAME"
  printf '%s\n' "$prev" > "$STATE_DIR/previous-web"
  printf '%s\n' "$WEB_VARIANT_NAME" > "$STATE_DIR/web-variant"
}

# 回滚专用：只更新「当前版本」，保留原来的 previous-web，
# 免得再回滚一次又被弹回那个刚被判定有问题的版本。
set_live_web_variant() {
  mkdir -p "$STATE_DIR"
  printf '%s\n' "$WEB_VARIANT_NAME" > "$STATE_DIR/web-variant"
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
  #
  # 刻意不加 --only：ecosystem.config.js 里的 english-server 和 english-ai 由同一次
  # startOrReload 统一接管，所以新增或改动进程都只改那一个文件，不存在「一个自动一个手动」
  pm2 startOrReload deploy/ecosystem.config.js
  pm2 save
}

do_deploy() {
  # 先解析变体：参数写错就在这里报错，不必等到服务器上跑了一半
  resolve_web_variant
  log "本次发布前端: $WEB_VARIANT_NAME（包 $WEB_PKG，产物 $WEB_DIR/dist，挂载点 $WEB_MOUNT）"
  preflight
  pull_code
  install_build
  assert_artifacts
  migrate_db
  sync_web
  record_web_state
  assert_layout
  reload_pm2
  log "发布完成: $(cd "$REPO_DIR" && git rev-parse --short HEAD)"
  bash "$REPO_DIR/deploy/verify.sh"
  printf '\n本次发布前端版本: %s\n' "$WEB_VARIANT_NAME"
  printf '切换另一版: bash deploy/deploy.sh --deploy --web vue\|react\n'
  printf '日志查看: pm2 logs %s / pm2 logs english-ai\n' "$PM2_APP"
}

do_rollback() {
  # 前端版本也要一起回退：目标是「上一次发布之前线上跑的那版」。
  # 必须在后面 install_build / sync_web 之前定下来，它们都按这个变体走。
  local prev_web=''
  if [ -f "$STATE_DIR/previous-web" ]; then
    prev_web="$(tr -d '[:space:]' < "$STATE_DIR/previous-web")"
  fi
  if [ -n "$prev_web" ] && is_valid_variant "$prev_web"; then
    WEB_VARIANT="$prev_web"
  else
    warn "没有可用的前端版本记录（$STATE_DIR/previous-web），沿用线上当前的前端版本"
    WEB_VARIANT=''
  fi
  resolve_web_variant
  log "本次回滚前端: $WEB_VARIANT_NAME（包 $WEB_PKG）"

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
  [ -d "$REPO_DIR/$WEB_DIR" ] || die "回滚目标 $sha 里没有 $WEB_DIR，无法重建变体 $WEB_VARIANT_NAME。可显式指定要重建的前端：WEB_VARIANT=vue bash deploy/deploy.sh --rollback"
  # 刻意不跑 migrate_db：回滚的是代码，不是数据库。
  # migrate deploy 只能向前应用迁移，没有自动反向迁移，所以回滚前要确认那次发布
  # 没有带不可逆的 schema 变更；verify.sh 的第 6 项会把这种情况报出来。
  install_build
  assert_artifacts
  sync_web
  set_live_web_variant
  assert_layout
  reload_pm2
  log "回滚完成（前端变体: $WEB_VARIANT_NAME）"
  bash "$REPO_DIR/deploy/verify.sh"
}

do_print_plan() {
  resolve_web_variant
  local live
  live="$(live_web_variant)"
  printf '\n前端变体 : %s\n' "$WEB_VARIANT_NAME"
  printf '包名     : %s\n' "$WEB_PKG"
  printf '产物目录 : %s/%s/dist\n' "$REPO_DIR" "$WEB_DIR"
  printf '挂载点   : %s\n' "$WEB_MOUNT"
  printf '部署分支 : %s\n' "$BRANCH"
  printf '代码目录 : %s\n' "$REPO_DIR"
  printf 'web 根   : %s\n' "$WEB_ROOT"
  printf '线上当前 : %s\n' "${live:-（无记录，按首次发布默认 vue 处理）}"
  printf '状态目录 : %s\n' "$STATE_DIR"
  printf '\n以上为本地解析结果，未触碰服务器。\n\n'
}

ACTION='--deploy'
while [ $# -gt 0 ]; do
  case "$1" in
    --deploy)     ACTION='--deploy'; shift ;;
    --rollback)   ACTION='--rollback'; shift ;;
    --print-plan) ACTION='--print-plan'; shift ;;
    --web)        [ $# -ge 2 ] || die "--web 需要跟一个变体名（可选: $WEB_VARIANTS）"; WEB_VARIANT="$2"; shift 2 ;;
    --branch)     [ $# -ge 2 ] || die "--branch 需要跟一个分支名（默认 $BRANCH）"; BRANCH="$2"; shift 2 ;;
    -h|--help)    ACTION='--help'; shift ;;
    *)            usage; die "未知参数: $1" ;;
  esac
done

case "$ACTION" in
  --deploy)     do_deploy ;;
  --rollback)   do_rollback ;;
  --print-plan) do_print_plan ;;
  --help)       usage ;;
esac
