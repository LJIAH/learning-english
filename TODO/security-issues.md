# 双 Token 认证待修复问题

## 🔴 严重

### 1. accessToken 过期时间只有 10 秒

- **文件**：`server/libs/shared/src/shared.module.ts`
- **问题**：`signOptions: { expiresIn: 10 }` 数字单位是秒，accessToken 仅 10 秒有效，用户体验极差
- **修复**：改为字符串格式，如 `expiresIn: '15m'`

### 2. accessToken 生成未显式指定过期时间

- **文件**：`server/apps/server/src/auth/auth.service.ts`
- **问题**：`generateToken` 中 accessToken 依赖全局默认值，意图不明确
- **修复**：显式传入 `{ expiresIn: '15m' }`

---

## 🟡 中等

### 3. refreshToken 无状态，无法主动吊销（Token 永生）

- **文件**：`server/apps/server/src/auth/auth.service.ts`
- **问题**：refreshToken 用纯 JWT 签发，服务端无存储，用户登出/改密码/封号后 refreshToken 在 7 天内仍有效
- **修复方案**：数据库增加 `tokenVersion` 字段或 refreshToken 白名单，刷新时校验

### 4. 刷新后旧 refreshToken 仍可继续使用

- **文件**：`server/apps/server/src/user/user.service.ts`（`refreshToken` 方法）
- **问题**：每次刷新签发新 token 对，但旧 refreshToken 因无状态仍可重复使用
- **修复方案**：refreshToken 单次使用，刷新后立即失效

### 5. 登录接口无暴力破解防护

- **文件**：`server/apps/server/src/user/user.controller.ts`（`login` 接口）
- **问题**：无频率限制，攻击者可无限尝试密码
- **修复**：引入 `@nestjs/throttler`，对登录接口做请求频率限制

---

## 🟢 低风险

### 6. refreshToken 存储在 localStorage（XSS 风险）

- **文件**：`apps/web/src/stores/user.ts`
- **问题**：通过 Pinia persist 存储在 localStorage，XSS 攻击可直接读取 token
- **修复**：将 refreshToken 改存 httpOnly cookie
