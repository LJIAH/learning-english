import type { CreatePayDto, ResultPay } from "@en/common/pay";

/**
 * 支付接口 —— 对应 Vue 版 apis/pay/index.ts，当前为 mock 实现。
 *
 * 与 Vue 版一致：用 `code === 200` 判断成功（而非 success 字段），
 * 因为支付走的是网关返回结构。接入真实后端时只需替换函数体。
 */

const EXPIRE_MS = 15 * 60 * 1000; // 支付有效期 15 分钟

export async function createPay(data: CreatePayDto): Promise<{
  code: number;
  data?: ResultPay;
  message?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!data.courseId) {
    return { code: 400, message: "课程 ID 不能为空" };
  }

  return {
    code: 200,
    data: {
      // mock：真实环境这里返回支付宝收银台地址
      payUrl: `https://example.com/pay?subject=${encodeURIComponent(data.subject)}`,
      timeExpire: Date.now() + EXPIRE_MS,
    },
  };
}
