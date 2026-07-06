import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { InterceptorInterceptor } from "@libs/shared/interceptor/interceptor";
import { InterceptorExceptionFilter } from "@libs/shared/interceptor/exceptionFilter";
import { Config } from "@en/config";
import { VersioningType } from "@nestjs/common";
import cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 信任反向代理，使限流器(Throttler)能获取真实客户端 IP
  app.set("trust proxy", 1);
  // 解析 httpOnly cookie 中的 refreshToken
  app.use(cookieParser());
  // tracker SDK 通过 sendBeacon/fetch 跨域上报，且刷新 token 需携带 cookie，开启 CORS 凭证支持
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalInterceptors(new InterceptorInterceptor());
  app.useGlobalFilters(new InterceptorExceptionFilter());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.listen(Config.ports.server);
}
bootstrap().catch((err) => {
  console.error(err);
});
