The user wants me to explain the changes made to `main.ts`. Let me read the current file and then explain the changes.
The user wants me to explain the changes to main.ts. Let me compare what the code looked like before the fix and after the fix, and explain each line.

Let me recall the original main.ts (before the fix):

```typescript
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { InterceptorInterceptor } from "@libs/shared/interceptor/interceptor";
import { InterceptorExceptionFilter } from "@libs/shared/interceptor/exceptionFilter";
import { Config } from "@en/config";
import { VersioningType } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalInterceptors(new InterceptorInterceptor());
  app.useGlobalFilters(new InterceptorExceptionFilter());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.listen(Config.ports.server);
}
bootstrap().catch((err) => {
  console.error(err);
});
```

The three changes:

1. **Import**: Added `import cookieParser from "cookie-parser";`
2. **trust proxy**: Added `app.set("trust proxy", 1);`
3. **Cookie parser**: Added `app.use(cookieParser());`
4. **CORS**: Added `app.enableCors({ origin: true, credentials: true });`

Now I need to explain why each one is needed.
`main.ts` 改动了 3 处，对应 3 个不同的需要：

### 改动对比

```
改动前（6 行逻辑）                    改动后（7 行逻辑）
─────────────────────────────────    ─────────────────────────────────
import { ... }  // 无 cookie-parser  → + import cookieParser from "cookie-parser";

                                     → + app.set("trust proxy", 1);
                                     → + app.use(cookieParser());
                                     → + app.enableCors({ origin: true, credentials: true });

app.useGlobalInterceptors(...)         app.useGlobalInterceptors(...)
app.useGlobalFilters(...)              app.useGlobalFilters(...)
app.setGlobalPrefix("api")             app.setGlobalPrefix("api")
app.enableVersioning(...)              app.enableVersioning(...)
app.listen(...)                        app.listen(...)
```

---

### 第 12-13 行：`app.set("trust proxy", 1)`

**为什么需要**：修复 #5（限流器 ThrottlerGuard）需要识别真实客户端 IP 来做频率限制。

你的部署架构中，请求先经过 Nginx/Vite proxy 再到 NestJS 服务器。如果不设置 `trust proxy`，Express 看到的 `req.ip` 永远是 `127.0.0.1`（代理的 IP），而不是真实用户 IP。这样限流器会对所有用户共用一个计数器，要么所有人被一起限流，要么完全不起作用。

```
无 trust proxy：
用户 A → Nginx → NestJS：req.ip = 127.0.0.1
用户 B → Nginx → NestJS：req.ip = 127.0.0.1  ← 两人一样！

有 trust proxy：
用户 A → Nginx(1.2.3.4) → NestJS：req.ip = 1.2.3.4
用户 B → Nginx(5.6.7.8) → NestJS：req.ip = 5.6.7.8  ← 各自独立计数
```

---

### 第 14-15 行：`import cookieParser` + `app.use(cookieParser())`

**为什么需要**：修复 #6 将 refreshToken 从响应体改存到了 httpOnly cookie 里。

后端需要在收到请求时把 cookie 解析成 `req.cookies.refreshToken` 才能读写。NestJS 默认不解析 cookie，需要 `cookie-parser` 中间件。

```typescript
// 没有 cookie-parser：
@Post('refresh-token')
async refreshToken(@Req() req) {
  req.cookies  // undefined！无法读取 refreshToken
}

// 有 cookie-parser：
@Post('refresh-token')
async refreshToken(@Req() req) {
  req.cookies.refreshToken  // "eyJhbG..."  ✅ 正常读取
}
```

---

### 第 16-17 行：`app.enableCors({ origin: true, credentials: true })`

**为什么需要**：浏览器发请求时，默认不会在跨域请求中携带 cookie。`credentials: true` 告诉浏览器"这个请求可以带 cookie"。

你的前端地址是 `localhost:xxxx`，API 地址是 `localhost:yyyy`（不同端口算跨域），或者通过 Vite proxy 转发。如果不开启 `credentials`，即使服务端设置了 `Set-Cookie`，浏览器也不会在后续请求里把 cookie 带上，refreshToken 机制直接失效。

```
无 credentials：
  前端 POST /api/auth/refresh-token
  → 浏览器：请求不带 cookie（跨域默认行为）
  → 后端：req.cookies.refreshToken = undefined
  → 失败！

有 credentials：
  前端 POST /api/auth/refresh-token  (withCredentials: true)
  → 浏览器：请求自动带上 refreshToken cookie
  → 后端：req.cookies.refreshToken = "eyJhb..."  ✅
```

**注意**：前端 axios 实例必须同步设置 `withCredentials: true`（已在 `apps/web/src/apis/index.ts` 中改动），光后端开 CORS 是不够的。

---

### 三行的顺序

```
trust proxy  →  最先设置，确保后续所有中间件拿到的是真实 IP
cookieParser →  在路由之前，确保 req.cookies 有值
enableCors   →  在路由之前，确保浏览器能正常跨域携带 cookie
```

三者都是在 `listen` 之前配置的，顺序本身不影响功能（都是注册中间件），但 `trust proxy` 放最前面是 Express 最佳实践。

The user is asking what `origin: true` means in the CORS configuration `app.enableCors({ origin: true, credentials: true })`.

Let me explain this clearly.

`origin: true` means "reflect the request's Origin header back as the Access-Control-Allow-Origin value". This is a convenient shortcut that effectively allows any origin to make requests, but without using the wildcard `*`.

The key reason for using `true` instead of `*` is that `credentials: true` and `Access-Control-Allow-Origin: *` are incompatible per the CORS spec. When credentials are included, the Origin must be explicitly listed, not a wildcard. Setting `origin: true` makes Express dynamically reflect whatever Origin the request came from.

## `origin: true` 的含义

它是一个**动态反射**的快捷方式，等效于：

```
无论请求来自哪个域名，都原样反射回去
请求 Origin: http://localhost:5173  →  响应 Access-Control-Allow-Origin: http://localhost:5173
请求 Origin: https://example.com   →  响应 Access-Control-Allow-Origin: https://example.com
```

---

### 为什么用 `true` 而不用 `*`？

CORS 规范明确规定：**`credentials: true` 和 `Access-Control-Allow-Origin: *` 不能同时存在**。

```typescript
// ❌ 浏览器会直接拒绝，报错：
// "credentialed request but Access-Control-Allow-Origin is wildcard (*)"
app.enableCors({ origin: "*", credentials: true });

// ✅ 动态反射，每次匹配请求的 Origin
app.enableCors({ origin: true, credentials: true });
```

---

### 三种常见值的区别

| 值                     | 行为                                 | 适用场景                           |
| ---------------------- | ------------------------------------ | ---------------------------------- |
| `true`                 | 动态反射，请求带什么 Origin 就回什么 | **开发阶段**，前端端口不固定       |
| `*`                    | 固定返回 `*`，允许所有来源           | 公开 API，但**不能带 credentials** |
| `'https://mysite.com'` | 只允许特定域名                       | **生产环境**，严格限制来源         |

---

### 你们项目的情况

当前 `origin: true` 是一个比较宽松的开发配置。因为前端通过 Vite proxy 转发（`vite.config.ts` 里配置了 `/api` 代理），所以实际请求是同域的，跨域检查不会触发。这个 CORS 设置主要是为以下场景兜底：

1. **tracker SDK** 通过 `sendBeacon`/`fetch` 直接向 API 上报（不走 Vite proxy）
2. 未来如果前后端分开部署在不同域名，cookie 机制需要跨域携带

上线前建议把 `origin: true` 改成具体的前端域名，比如：

```typescript
app.enableCors({
  origin: ["https://yourapp.com"],
  credentials: true,
});
```
