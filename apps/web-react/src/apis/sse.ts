import { fetchEventSource } from "@microsoft/fetch-event-source";

/** 只为取一个 method 类型而引入 axios 不值当，这里用字面量联合 */
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * SSE —— 对应 Vue 版 apis/sse/index.ts，原样搬运（本就零框架依赖）。
 *
 * onerror 里必须 throw：fetch-event-source 默认会自动重连，
 * 这里显式抛出以阻止重试，避免失败后无限重发请求。
 */
export const CHAT_URL = "/ai/v1/chat";

export const sse = <T, V = unknown>(
  url: string,
  method: HttpMethod = "POST",
  body: V,
  callback?: (data: T) => void,
  errorCallback?: (error: unknown) => void,
) => {
  return fetchEventSource(url, {
    method: method.toLocaleLowerCase(),
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    openWhenHidden: true,
    onmessage: (event) => {
      callback?.(JSON.parse(event.data) as T);
    },
    onerror: (error) => {
      errorCallback?.(error);
      throw error;
    },
  });
};
