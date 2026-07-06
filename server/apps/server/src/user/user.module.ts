import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    AuthModule,
    // 登录接口暴力破解防护：默认 60s 内 100 次，login 路由单独收紧到 5 次
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
  ],
})
export class UserModule {}
