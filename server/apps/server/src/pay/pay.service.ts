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
import type { Request } from "express";
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
  async notify(req: Request) {
    // console.log(req.body);
    const body = JSON.parse(req.body.body) as {
      courseId: string;
      userId: string;
    };
    this.prisma.$transaction(async (tx) => {
      // 1. 更新支付库 支付时间 + 支付宝交易号 + 支付状态
      const paymentRecord = await tx.paymentRecord.update({
        where: {
          outTradeNo: req.body.out_trade_no,
        },
        data: {
          tradeNo: req.body.trade_no, // 支付宝交易号
          tradeStatus: TradeStatus.TRADE_SUCCESS, // 支付状态
          sendPayTime: dayjs(req.body.gmt_payment).toDate(), // 支付时间
        },
      });
      // 2. 创建【我的课程】：课程记录
      await tx.courseRecord.create({
        data: {
          userId: body.userId,
          courseId: body.courseId,
          isPurchased: true,
          paymentRecordId: paymentRecord.id,
        },
      });
      //3. 通知前端socket
      this.socketGateway.emitPaymentSuccess(body.userId);
    });

    return true;
  }
}
