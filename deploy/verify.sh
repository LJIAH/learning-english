#!/usr/bin/env bash
#
# 发布后自检（只读状态、不改数据，可单独执行）
#
#   bash deploy/verify.sh
#   VERIFY_TRACKER=1 bash deploy/verify.sh   额外跑 tracker 完整链路（会往库里写测试记录）
#
# 检查项:
#   1. 3000 端口有监听
#   2. 接口能返回结构化响应（用注册接口的空 body 探针，期望 400 参数校验）
#   3. CORS 白名单与 server/.env 里的 CORS_ORIGIN 一致（预检期望带回 Allow-Origin）
#   4. 非白名单来源不再返回 5xx（回归检查：这曾经是个把整个接口打成 500 的 bug）
#   5. 可选 tracker 链路 UV -> event
#
# 刻意不用 set -e：自检要把所有项跑完再汇总，不能第一项失败就退出

set -uo pipefail

REPO_DIR="${REPO_DIR:-/www/wwwroot/english-code}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/english.kevy.top}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api/v1}"

fail=0
pass() { printf '  [PASS] %s\n' "$*"; }
bad()  { printf '  [FAIL] %s\n' "$*"; fail=1; }
note() { printf '  [ -- ] %s\n' "$*"; }

probe_register() { # $1 = Origin（可为空）
  if [ -n "${1:-}" ]; then
    curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST \
      -H "Origin: $1" -H 'Content-Type: application/json' -d '{}' \
      "$API_BASE/user/register" 2>/dev/null
  else
    curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST \
      -H 'Content-Type: application/json' -d '{}' \
      "$API_BASE/user/register" 2>/dev/null
  fi
}

printf '\n[1/4] 端口监听\n'
if command -v ss >/dev/null 2>&1; then
  if ss -lntp 2>/dev/null | grep -q ':3000'; then
    pass "3000 端口有监听"
  else
    bad "3000 端口没有监听（pm2 list 看进程状态）"
  fi
else
  note "系统没有 ss 命令，跳过端口检查，由下一项接口探针间接验证"
fi

printf '\n[2/4] 接口探针\n'
code="$(probe_register '')"
case "$code" in
  400) pass "POST /user/register 返回 400（参数校验生效，业务链路通）" ;;
  429) pass "POST /user/register 返回 429（触发限流，说明服务在正常处理请求）" ;;
  000) bad "接口无响应（连接被拒绝或超时）" ;;
  *)   bad "POST /user/register 返回 $code（期望 400，或 429 表示限流）" ;;
esac

printf '\n[3/4] CORS 白名单与 .env 一致性\n'
env_file="$REPO_DIR/server/.env"
origin=""
if [ ! -f "$env_file" ]; then
  bad "找不到 $env_file，无法核对白名单"
else
  raw="$(grep -E '^[[:space:]]*CORS_ORIGIN=' "$env_file" | tail -1 | cut -d= -f2- | tr -d "\"'")"
  if [ -z "$raw" ]; then
    bad "server/.env 里没有 CORS_ORIGIN：代码会退回只放行 localhost，浏览器请求会被拒（表现为接口 500）"
  else
    origin="$(printf '%s' "$raw" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -m1 '^https\?://' || true)"
    if [ -z "$origin" ]; then
      bad "CORS_ORIGIN 里没有可识别的 http(s) 来源: $raw"
    else
      hdr="$(curl -s -i --max-time 10 -X OPTIONS -H "Origin: $origin" \
        -H 'Access-Control-Request-Method: POST' "$API_BASE/user/register" 2>/dev/null | tr -d '\r')"
      if printf '%s' "$hdr" | grep -qi '^Access-Control-Allow-Origin:'; then
        pass "预检 $origin 通过（响应带 Access-Control-Allow-Origin）"
      else
        bad "预检 $origin 失败：.env 里的白名单和运行时不一致，线上浏览器请求会被 CORS 拒绝"
      fi
    fi
  fi
fi

printf '\n[4/4] 非白名单来源回归检查\n'
code="$(probe_register 'https://not-in-whitelist.example.com')"
if [ "$code" -ge 500 ] 2>/dev/null; then
  bad "非白名单来源返回 $code（期望 4xx）：CORS 拒绝被抛成异常，会被 Nest 兜底成 500"
elif [ "$code" = "000" ]; then
  bad "非白名单来源请求无响应"
else
  pass "非白名单来源返回 $code（非 5xx，符合预期）"
fi

if [ "${VERIFY_TRACKER:-0}" = "1" ]; then
  printf '\n[可选] tracker 链路 UV -> event\n'
  vid="$(curl -s --max-time 10 -X POST -H 'Content-Type: application/json' \
    -d '{"anonymousId":"deploy-verify","browser":"curl","os":"linux","device":"server"}' \
    "$API_BASE/tracker/uv" 2>/dev/null | sed -n 's/.*"data":"\([^"]*\)".*/\1/p')"
  if [ -z "$vid" ]; then
    bad "UV 上报没有返回 visitorId"
  else
    pass "UV 上报返回 visitorId=$vid"
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST \
      -H 'Content-Type: application/json' \
      -d "{\"visitorId\":\"$vid\",\"event\":\"deploy_verify\",\"url\":\"https://example.com/\"}" \
      "$API_BASE/tracker/event" 2>/dev/null)"
    if [ "$code" = "200" ]; then
      pass "事件上报返回 200"
    else
      bad "事件上报返回 $code（期望 200）"
    fi
  fi
fi

printf '\n'
if [ "$fail" = "0" ]; then
  printf '自检全部通过\n'
else
  printf '自检存在失败项，请按上面的提示排查\n' >&2
fi
exit "$fail"
