#!/usr/bin/env bash
#
# 服务器一次性初始化：把代码 clone 到独立目录，并把旧的「源码混在 web 根」布局迁走
#
# 为什么必须拿到服务器上跑：
#   本地是 Windows（没有 rsync），也不该把本地构建的 dist / node_modules 传上去
#   —— 换行符、原生模块、文件权限都会出问题。所以：服务器上 clone、服务器上构建。
#
# 本文件是单文件、自包含的，不依赖仓库已存在：
#   scp deploy/bootstrap.sh root@<server>:/root/
#   bash /root/bootstrap.sh <仓库地址>           # 计划模式：只打印，不改动
#   bash /root/bootstrap.sh <仓库地址> --yes     # 真正执行
#
# 可用环境变量覆盖：REPO_DIR BRANCH WEB_ROOT WEB_OWNER PM2_APP OLD_PM2_APP BACKUP_DIR
#
# 注意：为了让新进程拿到 3000 端口，会先停掉旧的 pm2 进程，因此有秒级停机。
#
# 迁移完成后（web 根里不再有 server/.env）再跑本脚本会被前置检查直接拒绝，
# 并提示改用 deploy/deploy.sh —— 避免在已经迁好的机器上重复执行迁移。

set -euo pipefail

REPO_URL="${1:-}"
CONFIRM="${2:-}"

REPO_DIR="${REPO_DIR:-/www/wwwroot/english-code}"
BRANCH="${BRANCH:-master}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/english.kevy.top}"
WEB_OWNER="${WEB_OWNER:-www:www}"
PM2_APP="${PM2_APP:-english-server}"                 # 新进程名，见 ecosystem.config.js
OLD_PM2_APP="${OLD_PM2_APP:-main}"                   # 迁移前的旧进程名
BACKUP_DIR="${BACKUP_DIR:-/www/backup/english-pre-migration-$(date +%Y%m%d%H%M%S)}"

# 旧布局里被混进 web 根的「非静态」内容，迁移时全部移出
NON_STATIC=(server packages node_modules package.json pnpm-lock.yaml pnpm-workspace.yaml .gitignore .git .env .env.bak)

if [ -z "$REPO_URL" ]; then
  sed -n '2,20p' "$0"
  exit 2
fi

if [ "$CONFIRM" = "--yes" ]; then DRY=0; else DRY=1; fi

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  [warn] %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m  [ ok ] %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m[error] %s\033[0m\n' "$*" >&2; exit 1; }

run() { # 简单命令：执行或打印
  if [ "$DRY" = "1" ]; then printf '    [dry-run] %s\n' "$*"; else "$@"; fi
}
run_sh() { # $1=命令串 $2=工作目录（可选），用于需要 cd / 管道的场合
  if [ "$DRY" = "1" ]; then printf '    [dry-run] (cd %s && %s)\n' "${2:-.}" "$1"; return 0; fi
  if [ -n "${2:-}" ]; then ( cd "$2" && bash -euo pipefail -c "$1" ); else bash -euo pipefail -c "$1"; fi
}

preflight() {
  log "1/8 前置检查"
  [ "$(id -u)" = "0" ] || die "请用 root 执行：需要改文件属主、操作 pm2"
  local c
  for c in git node pnpm pm2 rsync curl; do
    command -v "$c" >/dev/null 2>&1 || die "缺少命令: $c"
  done
  ok "git / node / pnpm / pm2 / rsync / curl 均可用"
  printf '    node %s | pnpm %s\n' "$(node -v)" "$(pnpm -v)"

  [ -d "$WEB_ROOT" ] || die "找不到 web 根目录 $WEB_ROOT"
  # 已经迁移过的机器：旧配置已经被 mv 进备份目录，web 根里不再有 server/.env。
  # 这种情况再跑初始化没有意义，也不是它能处理的，直接把人指到日常发布脚本。
  if [ ! -f "$WEB_ROOT/server/.env" ] && [ -f "$REPO_DIR/server/.env" ]; then
    die "看起来已经迁移过了：$REPO_DIR/server/.env 已就位，而 $WEB_ROOT 里已无旧配置（应该已被移入备份目录）。
  日常发布请用：bash $REPO_DIR/deploy/deploy.sh --deploy
  只核对线上状态：bash $REPO_DIR/deploy/verify.sh"
  fi
  [ -f "$WEB_ROOT/server/.env" ] || die "找不到旧配置 $WEB_ROOT/server/.env。这是要沿用的密钥文件，不能重新生成，也不该猜"
  ok "找到旧配置 $WEB_ROOT/server/.env"

  if [ -d "$REPO_DIR/.git" ]; then
    warn "$REPO_DIR 已存在且是 git 检出：这次只做拉取更新，不会重新克隆"
  elif [ -e "$REPO_DIR" ]; then
    die "$REPO_DIR 已存在但不是 git 检出（可能是上一次遗留的目录）。人工确认后搬走它再重跑"
  else
    ok "$REPO_DIR 尚不存在，将执行 clone"
  fi

  if pm2 describe "$OLD_PM2_APP" >/dev/null 2>&1; then
    warn "检测到旧 pm2 进程 '$OLD_PM2_APP'，它占着 3000 端口，稍后会被停止并删除"
  else
    warn "没检测到旧 pm2 进程 '$OLD_PM2_APP'（若旧进程名不同，用 OLD_PM2_APP=xxx 指定）"
  fi
}

clone_code() {
  log "2/8 准备代码目录 $REPO_DIR"
  if [ -d "$REPO_DIR/.git" ]; then
    warn "已有代码目录，改为拉取 $BRANCH 最新代码（构建失败后可直接重跑本脚本）"
    run_sh "git fetch origin '$BRANCH' && git checkout '$BRANCH' && git merge --ff-only 'origin/$BRANCH'" "$REPO_DIR"
    return 0
  fi
  run_sh "git clone --branch '$BRANCH' '$REPO_URL' '$REPO_DIR'" /www/wwwroot || die "clone 失败。
  私有仓库需要在服务器上配只读部署密钥：
    ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ''
    把 ~/.ssh/deploy_key.pub 加到 GitHub 仓库 Settings -> Deploy keys（只勾读权限）
    GIT_SSH_COMMAND='ssh -i ~/.ssh/deploy_key' git clone <repo> $REPO_DIR"
}

migrate_env() {
  log "3/8 沿用现网配置（密钥不重新生成）"
  if [ -f "$REPO_DIR/server/.env" ]; then
    warn "代码目录里已有 server/.env，保持不动（不覆盖，避免把已改好的配置冲掉）"
  else
    run install -m 600 "$WEB_ROOT/server/.env" "$REPO_DIR/server/.env"
  fi
  if [ "$DRY" = "0" ]; then
    if grep -qE '^[[:space:]]*CORS_ORIGIN=' "$REPO_DIR/server/.env"; then
      ok "CORS_ORIGIN 已存在"
    else
      warn "server/.env 里没有 CORS_ORIGIN —— 这正是之前接口 500 的根因。请补上："
      warn 'CORS_ORIGIN="https://english.kevy.top"'
    fi
  fi
}

install_build() {
  log "4/8 安装依赖、应用数据库迁移并构建（顺序不可变：install -> generate -> migrate -> tracker -> web -> server -> ai）"
  printf '    说明：没有 postinstall 钩子，prisma generate 必须显式跑；web 依赖 tracker 的 dist\n'
  run_sh "pnpm install --frozen-lockfile" "$REPO_DIR"
  run_sh "pnpm --filter @en/server run prisma:generate" "$REPO_DIR"
  # 全新库必须先把迁移应用上去，否则应用起来连表都没有
  run_sh "pnpm --filter @en/server exec prisma migrate deploy" "$REPO_DIR"
  run_sh "pnpm --filter @en/tracker build" "$REPO_DIR"
  run_sh "pnpm --filter @en/web build" "$REPO_DIR"
  run_sh "pnpm --filter @en/server build" "$REPO_DIR"
  # apps/ai 与 apps/server 同在 server/ 这个 nest 项目下，产物是另一条嵌套路径
  run_sh "pnpm --filter @en/server run build:ai" "$REPO_DIR"
}

assert_artifacts() {
  log "5/8 校验构建产物"
  if [ "$DRY" = "1" ]; then
    printf '    [dry-run] 检查后端入口文件、前端 index.html，并确认 bundle 里带站点地址\n'
    return 0
  fi
  local entry="$REPO_DIR/server/dist/apps/server/apps/server/src/main.js"
  [ -f "$entry" ] || die "找不到后端入口 $entry（nest build 输出路径变了？用 find $REPO_DIR/server/dist -name main.js 确认）"
  ok "后端入口存在"
  local ai_entry="$REPO_DIR/server/dist/apps/ai/apps/ai/src/main.js"
  [ -f "$ai_entry" ] || die "找不到 AI 应用入口 $ai_entry（build:ai 没跑或失败，ecosystem.config.js 里的 english-ai 会起不来）"
  ok "AI 应用入口存在"
  [ -f "$REPO_DIR/apps/web/dist/index.html" ] || die "找不到前端产物 apps/web/dist/index.html"
  if grep -rq 'english.kevy.top' "$REPO_DIR/apps/web/dist/assets"; then
    ok "前端 bundle 带站点地址（apps/web/.env.production 生效）"
  else
    die "前端 bundle 里没有站点地址：apps/web/.env.production 没被加载，上传/头像/课程图/Socket 会全挂"
  fi
}

switch_pm2() {
  log "6/8 切换进程（先停旧进程释放 3000，秒级停机）"
  if pm2 describe "$OLD_PM2_APP" >/dev/null 2>&1; then
    run pm2 delete "$OLD_PM2_APP"
  fi
  run pm2 startOrReload "$REPO_DIR/deploy/ecosystem.config.js" --update-env
  run pm2 save
  if [ "$DRY" = "0" ]; then
    # Nest + Prisma 冷启动要十几秒（cluster 2 实例更慢），固定 sleep 会误报。
    # 3000（english-server）和 3001（english-ai）都要等到
    local i p
    for i in $(seq 1 60); do
      if ss -lntp 2>/dev/null | grep -q ':3000' && ss -lntp 2>/dev/null | grep -q ':3001'; then
        break
      fi
      sleep 1
    done
    for p in 3000 3001; do
      if ss -lntp 2>/dev/null | grep -q ":$p"; then
        ok "$p 端口已监听（等待 ${i}s）"
      else
        warn "等了 60s $p 端口还是没监听，排查：pm2 logs"
      fi
    done
  fi
}

migrate_files() {
  log "7/8 非静态内容移出 web 根 -> $BACKUP_DIR，并同步前端产物"
  run mkdir -p "$BACKUP_DIR"
  local item
  for item in "${NON_STATIC[@]}"; do
    if [ -e "$WEB_ROOT/$item" ]; then
      run mv "$WEB_ROOT/$item" "$BACKUP_DIR/"
    fi
  done
  run_sh "rsync -a --delete --human-readable --exclude='.user.ini' --exclude='.htaccess' --exclude='.well-known/' --chown='$WEB_OWNER' '$REPO_DIR/apps/web/dist/' '$WEB_ROOT/'"
}

final_checks() {
  log "8/8 发布后自检"
  run_sh "bash '$REPO_DIR/deploy/verify.sh'" "$REPO_DIR"

  cat <<'NEXT'

需要人工确认后操作的两件事：

  1. 精简 nginx 站点配置。web 根里现在已经只有静态产物，不再包含源码，
     所以那两个「禁止访问敏感文件/目录」的 location 块可以删掉。
     删之前先通读配置确认没有别的用途：
       /www/server/panel/vhost/nginx/html_english.kevy.top.conf
       同目录扩展文件：api.conf / spa.conf / minio.conf
     改完：nginx -t && nginx -s reload

  2. english-ai 已经跟着起来了（3001 端口，nginx 的 /ai/ 反代指向它）。
     但它注册了每天 00:00 的 BullMQ 定时任务，会给「开了定时任务 + 留了邮箱 + 当天背过
     单词」的用户跑 LLM 生成日报并真实发信。发信链路还没准备好就先 `pm2 stop english-ai`
     （注意下一次 deploy.sh 的 startOrReload 会把它再拉起来）。

之后的日常操作：
  发布   bash deploy/deploy.sh --deploy
  回滚   bash deploy/deploy.sh --rollback
  自检   bash deploy/verify.sh
NEXT
}

main() {
  printf '\033[1m服务器初始化 / 布局迁移\033[0m\n'
  printf '  仓库      : %s (%s)\n' "$REPO_URL" "$BRANCH"
  printf '  代码目录  : %s\n' "$REPO_DIR"
  printf '  web 根    : %s\n' "$WEB_ROOT"
  printf '  备份目录  : %s\n' "$BACKUP_DIR"
  if [ "$DRY" = "1" ]; then
    printf '  模式      : 计划模式（只打印，不做任何改动）\n'
  else
    printf '  模式      : 实际执行（有秒级停机）\n'
  fi

  preflight
  clone_code
  migrate_env
  install_build
  assert_artifacts
  switch_pm2
  migrate_files
  final_checks

  if [ "$DRY" = "1" ]; then
    printf '\n以上为计划模式，未做任何改动。确认无误后加 --yes 重跑。\n'
  else
    printf '\n初始化完成。\n'
  fi
}

main
