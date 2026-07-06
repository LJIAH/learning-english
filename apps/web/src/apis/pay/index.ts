import { serverRequest } from "..";
import type { CreatePayDto, ResultPay } from "@en/common/pay";
// 创建支付
export const createPay = (data: CreatePayDto) =>
  serverRequest.post<ResultPay>("/pay/create", data);
