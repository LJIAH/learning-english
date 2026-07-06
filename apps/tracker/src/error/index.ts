import type { ErrorDto } from "@en/common/tracker";
import { getConfig } from "@/config";
import { report } from "@/report";

export const reportError = (visitorId: string) => {
  const config = getConfig();
  const url = config.baseUrl + config.error!.api;
  // 捕获全局JS错误
  window.addEventListener("error", (e) => {
    const body: ErrorDto = {
      visitorId,
      error: "js",
      message: e.error.message,
      stack: e.error.stack,
      url: e.filename,
    };
    report(url, body);
  });
  // 捕获未处理的Promise错误
  window.addEventListener("unhandledrejection", (e) => {
    // 因为报错原因可能是Promise.reject(new Error()) 也可能是Promise.reject(其他类型)，所以需要判断
    const isError = e.reason instanceof Error;
    const body: ErrorDto = {
      visitorId,
      error: "promise",
      message: isError ? e.reason.message : JSON.stringify(e.reason),
      stack: isError ? e.reason.stack || "" : "Promise Rejection",
      url: window.location.href,
    };
    report(url, body);
  });
};
