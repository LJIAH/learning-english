import { Injectable, OnModuleInit } from "@nestjs/common";
import * as Minio from "minio";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly minioClient: Minio.Client;
  constructor(private readonly configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: configService.get<string>("MINIO_ENDPOINT")!,
      port: Number(configService.get<number>("MINIO_PORT")),
      useSSL: !!Number(configService.get<boolean>("MINIO_USE_SSL")),
      accessKey: configService.get<string>("MINIO_ACCESS_KEY"),
      secretKey: configService.get<string>("MINIO_SECRET_KEY"),
    });
  }
  // 获取Minio客户端
  getClient() {
    return this.minioClient;
  }
  // 获取Minio存储桶名称
  getBucket() {
    return this.configService.get<string>("MINIO_BUCKET")!;
  }
  // 在NestJS模块初始化时执行
  async onModuleInit() {
    const bucket = this.getBucket();
    const exist = await this.minioClient.bucketExists(bucket);
    if (!exist) {
      await this.minioClient.makeBucket(bucket);
      await this.minioClient.setBucketPolicy(
        bucket,
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicReadGetObject", // 给这个规则起个名字
              Effect: "Allow", // 允许打开这个规则
              Principal: "*", // 允许所有人
              Action: ["s3:GetObject"], // 允许浏览器读取对象
              Resource: [`arn:aws:s3:::${bucket}/*`], // 允许读取 bucket 中的所有资源！
            },
          ],
        }),
      );
    }
  }
}
