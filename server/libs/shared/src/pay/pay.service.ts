import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AlipaySdk } from "alipay-sdk";

@Injectable()
export class PayService implements OnModuleInit {
  public alipaySdk!: AlipaySdk;
  constructor(private readonly configService: ConfigService) {}
  async onModuleInit() {
    this.alipaySdk = new AlipaySdk({
      appId: this.configService.get<string>("ALIPAY_APP_ID")!,
      privateKey: this.configService.get<string>("ALIPAY_PRIVATE_KEY")!,
      alipayPublicKey: this.configService.get<string>("ALIPAY_PUBLIC_KEY")!,
      gateway: this.configService.get<string>("ALIPAY_GATEWAY")!,
    });
  }
  getAlipaySdk() {
    return this.alipaySdk;
  }
}
