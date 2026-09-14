import { Controller, Post, Body, UseGuards, Req, Res, All } from "@nestjs/common";
import { PayService } from "./pay.service";
import type { CreatePayDto } from "@en/common/pay";
import { AuthGuard } from "@libs/shared/auth/auth.guard";
import type { Request, Response } from "express";

@Controller("pay")
export class PayController {
  constructor(private readonly payService: PayService) {}

  @UseGuards(AuthGuard)
  @Post("create")
  create(@Body() createPayDto: CreatePayDto, @Req() req: Request) {
    const user = req.user;
    return this.payService.create(createPayDto, user);
  }
  // 支付宝异步通知：需返回字面量 success/fail，绕过全局拦截器的 JSON 包装，
  // 因此注入 @Res() 手动控制响应（Nest 不再把返回值写入响应）
  @All("notify")
  notify(@Req() req: Request, @Res() res: Response) {
    return this.payService.notify(req, res);
  }
}
