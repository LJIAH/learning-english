import { Module, Global } from "@nestjs/common";
import { SharedService } from "./shared.service";
import { PrismaModule } from "./prisma/prisma.module";
import { ResponseModule } from "./response/response.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MinioModule } from "./minio/minio.module";
import { PayModule } from "./pay/pay.module";
import { EmailModule } from "./email/email.module";
import { BullModule } from "@nestjs/bullmq";

@Global()
@Module({
  providers: [SharedService],
  exports: [
    SharedService,
    PrismaModule,
    ResponseModule,
    JwtModule,
    ConfigModule,
    MinioModule,
    PayModule,
    EmailModule,
  ], // ?? PrismaModule is also exported here then it is not necessary to import it in other modules but it is not an issue as it is already imported here when SharedModule is imported
  imports: [
    PrismaModule,
    ResponseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST"),
          port: Number(configService.get<number>("REDIS_PORT")),
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("SECRET_KEY"),
        signOptions: { expiresIn: "15m" },
      }),
    }),
    MinioModule,
    PayModule,
    EmailModule,
  ],
})
export class SharedModule {}
