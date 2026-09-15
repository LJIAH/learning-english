import { Injectable } from "@nestjs/common";
import { CreatePayDto } from "@en/common/pay";
import { TokenPayload } from "@en/common/user";
import {
  PrismaService,
  PayService as SharedPayService,
  ResponseService,
} from "@libs/shared";
import * as nanoid from "nanoid";
import dayjs from "dayjs";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { TradeStatus } from "@libs/shared/generated/prisma/enums";
import { SocketGateway } from "../socket/socket.gateway";

@Injectable()
export class PayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
    private readonly sharedPayService: SharedPayService,
    private readonly configService: ConfigService,
    private readonly socketGateway: SocketGateway,
  ) {}
  private createTradeNo() {
    const prifix = "AY";
    return `${prifix}-${nanoid.nanoid(12)}`;
  }
  async create(createPayDto: CreatePayDto, user: TokenPayload) {
    // 购买过的课程不能重复购买
    const courseRecord = await this.prisma.courseRecord.findFirst({
      where: {
        userId: user.userId,
        courseId: createPayDto.courseId,
      },
    });
    if (courseRecord) {
      return this.response.error(null, "您已经购买过该课程");
    }
    const result = await this.prisma.$transaction(async (tx) => {
      // 创建订单表
      const outTradeNo = this.createTradeNo();
      await tx.paymentRecord.create({
        data: {
          outTradeNo,
          userId: user.userId,
          amount: createPayDto.total_amount,
          subject: createPayDto.subject,
          body: createPayDto.body,
        },
      });
      // 支付宝SDK发起支付宝生成url
      const dateTime = dayjs().add(1, "minute");
      const payUrl = this.sharedPayService
        .getAlipaySdk()
        .pageExecute("alipay.trade.page.pay", "GET", {
          bizContent: {
            out_trade_no: outTradeNo,
            total_amount: createPayDto.total_amount,
            subject: createPayDto.subject,
            body: JSON.stringify({
              courseId: createPayDto.courseId,
              userId: user.userId,
            }),
            product_code: "FAST_INSTANT_TRADE_PAY",
            time_expire: dateTime.format("YYYY-MM-DD HH:mm:ss"),
          },
          notify_url:
            this.configService.get<string>("ALIPAY_NOTIFY_URL") +
            "/api/v1/pay/notify",
        });
      return {
        payUrl,
        timeExpire: dateTime.toDate().getTime(), // 迎合ElementPlus的组件要求的格式
      };
    });

    return this.response.success(result);
  }
  async notify(req: Request, res: Response) {
    try {
      // req.body.body 是创建订单时塞进去的 { courseId, userId }
      console.log("[pay] 收到支付宝异步通知", req.body);
      const body = JSON.parse(req.body.body) as {
        courseId: string;
        userId: string;
      };
      const handled = await this.prisma.$transaction(async (tx) => {
        const paymentRecord = await tx.paymentRecord.findUnique({
          where: { outTradeNo: req.body.out_trade_no },
        });
        // 订单不存在（数据异常）：进入 catch 返回 fail，让支付宝重试
        if (!paymentRecord) return "not_found";
        // 幂等：支付宝收不到 success 会重发通知，已处理过的直接确认
        if (paymentRecord.tradeStatus === TradeStatus.TRADE_SUCCESS) {
          return "duplicate";
        }
        // 1. 更新支付库 支付时间 + 支付宝交易号 + 支付状态
        await tx.paymentRecord.update({
          where: {
            outTradeNo: req.body.out_trade_no,
          },
          data: {
            tradeNo: req.body.trade_no, // 支付宝交易号
            tradeStatus: TradeStatus.TRADE_SUCCESS, // 支付状态
            sendPayTime: dayjs(req.body.gmt_payment).toDate(), // 支付时间
          },
        });
        // 2. 创建【我的课程】：课程记录（upsert 兜底 @@unique([userId, courseId])，重试不会重复创建）
        await tx.courseRecord.upsert({
          where: {
            userId_courseId: { userId: body.userId, courseId: body.courseId },
          },
          update: { isPurchased: true, paymentRecordId: paymentRecord.id },
          create: {
            userId: body.userId,
            courseId: body.courseId,
            isPurchased: true,
            paymentRecordId: paymentRecord.id,
          },
        });
        return "handled";
      });

      // 3. 只在首次处理成功时通知前端socket（事务提交后再发，回滚时不会误报）
      if (handled === "handled") {
        this.socketGateway.emitPaymentSuccess(body.userId);
      }
      // 支付宝要求返回字面量 success 才停止重试；重复通知同样回 success
      res.send("success");
    } catch (err) {
      // 处理失败：返回非 success，支付宝会按重试策略再次通知
      console.error("[pay] 支付宝异步通知处理失败", err);
      res.send("fail");
    }
  }
}
