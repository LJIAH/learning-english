import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;
  constructor(private readonly configService: ConfigService) {}
  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("EMAIL_HOST"),
      port: Number(this.configService.get<number>("EMAIL_PORT")),
      secure: !!Number(this.configService.get<number>("EMAIL_USE_SSL")),
      auth: {
        user: this.configService.get<string>("EMAIL_USER"),
        pass: this.configService.get<string>("EMAIL_PASSWORD"),
      },
    });
    // this.sendEmail("githublin@foxmail.com", "测试邮件", "<h1>Hello World</h1>");
  }
  // to: 收件人邮箱 subject: 邮件主题 text: 邮件内容
  async sendEmail(to: string, subject: string, text: string) {
    try {
      await this.transporter!.sendMail({
        from: this.configService.get<string>("EMAIL_USER"),
        to,
        subject,
        html: text,
      });
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}
