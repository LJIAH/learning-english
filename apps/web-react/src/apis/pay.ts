import type { CreatePayDto, ResultPay } from "@en/common/pay";
import { serverRequest } from "./request";

/**
 * 支付接口 —— 对应 Vue 版 apis/pay/index.ts。
 *
 * 与 Vue 版一致：用 `code === 200` 判断成功（而非 success 字段），
 * 因为支付走的是网关返回结构。
 */
export const createPay = (data: CreatePayDto) =>
  serverRequest.post<ResultPay>("/pay/create", data);
