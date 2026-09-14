import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { InterceptorInterceptor } from "@libs/shared/interceptor/interceptor";
import { InterceptorExceptionFilter } from "@libs/shared/interceptor/exceptionFilter";
import { Config } from "@en/config";
import { VersioningType, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// 解析允许跨域的来源白名单：
// 优先读取环境变量 CORS_ORIGIN（逗号分隔），未配置时默认放行本地开发端口
function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // 默认放行本地开发环境的前端与 tracker
  return [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 信任反向代理，使限流器(Throttler)能获取真实客户端 IP，以便于记录次数
  app.set("trust proxy", 1);

  // helmet：设置一组标准安全响应头（CSP、X-Frame-Options、X-Content-Type-Options 等）
  app.use(helmet());

  // 解析 httpOnly cookie 中的 refreshToken,这样后端可以req.cookies.refreshToken
  app.use(cookieParser());
  // CORS 仅允许白名单来源，配合 credentials: true 携带 cookie
  // 生产环境通过环境变量 CORS_ORIGIN 配置具体域名白名单
  const allowedOrigins = getCorsOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      // origin 为 undefined 时（同源请求或服务器到服务器）放行
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: 来源 ${origin} 不被允许`));
      }
    },
    credentials: true,
  });
  // 全局输入验证：剥离未声明字段、自动类型转换、对 DTO class 应用 class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new InterceptorInterceptor());
  app.useGlobalFilters(new InterceptorExceptionFilter());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.listen(Config.ports.server);
}
bootstrap().catch((err) => {
  console.error(err);
});
