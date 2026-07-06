import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { Method } from "axios";
export const CHAT_URL = "/ai/v1/chat";

export const sse = <T, V = any>(
  url: string,
  method: Method = "POST",
  body: V,
  callback?: (data: T) => void,
  errorCallback?: (error: any) => void,
) => {
  return fetchEventSource(url, {
    method: method.toLocaleLowerCase(),
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    openWhenHidden: true,
    onmessage: (event) => {
      callback?.(JSON.parse(event.data));
    },
    onerror: (error) => {
      errorCallback?.(error);
      throw error; // 抛出错误以阻止自动重试
    },
  });
};
