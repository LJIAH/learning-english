import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { router } from "@/router";
import { toast } from "@/stores/toast";
import { useUserStore } from "@/stores/user";
import { refreshTokenApi } from "./auth";

export const uploadUrl = import.meta.env.VITE_UPLOAD_URL ?? "";
export const timeout = 50000;

/**
 * socket.io 服务端地址 —— 对应 Vue 版 apis/index.ts 的 socketUrl。
 *
 * **留空 = 连当前页面的 origin**（useSocket 里 `io(socketUrl || undefined)`）：
 *   dev  → 由 vite.config 的 /socket.io 代理转发到 3000（同源，无 CORS）
 *   prod → nginx 把 /socket.io/ 反代到 3000（同样同源）
 * 所以两个环境都不需要配这一项；留着它只是为了本地特殊联调时能临时指向别处。
 */
export const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "";

export interface Response<T = unknown> {
  timestamp: string;
  path: string;
  message: string;
  code: number;
  success: boolean;
  data: T | null;
}

const request = <T>(p: Promise<unknown>) => p as Promise<Response<T>>;

/**
 * 创建类型安全的请求工具，内置标准响应拦截器。
 *
 * 对应 Vue 版 apis/index.ts —— 拦截器逻辑逐行对齐，差异只在框架替换：
 *   Pinia useUserStore()  → zustand useUserStore.getState()
 *   ElMessage.error()     → toast.error()
 *   router.push("/")      → router.navigate("/")
 *
 * 注意：这里 import router 会与 router → views → apis 形成循环引用，
 * 但 router 只在拦截器回调（运行时）里被访问，ESM 活绑定下安全 ——
 * 与 Vue 版的做法一致。
 */
const createApi = (baseURL: string) => {
  const api = axios.create({
    baseURL,
    timeout,
    // 携带凭证：接收/发送 httpOnly cookie（refreshToken）
    withCredentials: true,
  });

  let isRefreshing = false;
  let pendingQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  const flushQueue = (token: string | null, err?: unknown) => {
    pendingQueue.forEach(({ resolve, reject }) =>
      err ? reject(err) : resolve(token!),
    );
    pendingQueue = [];
  };

  // 请求拦截器：注入 accessToken
  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = useUserStore.getState().getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (err) => Promise.reject(err),
  );

  // 响应拦截器：直接返回 res.data（调用方拿到 Response<T>），401 走刷新重试
  api.interceptors.response.use(
    (res) => res.data,
    async (err: unknown) => {
      const axiosErr = err as {
        code?: string;
        response?: { status: number };
        config?: InternalAxiosRequestConfig;
      };
      const status = axiosErr.response?.status;
      const originalRequest = axiosErr.config;
      if (axiosErr.code === "ERR_NETWORK") {
        toast.error("网络连接失败,请重试");
        return Promise.reject(err);
      }

      // 无响应（网络错误/超时）或非 401，直接拒绝
      if (!status || status !== 401 || !originalRequest) {
        return Promise.reject(err);
      }

      // 401 token 过期
      const userStore = useUserStore.getState();
      const accessToken = userStore.getAccessToken();
      // 没有 accessToken 说明未登录；refreshToken 由 httpOnly cookie 维护，无需在前端判断
      if (!accessToken) {
        userStore.logout();
        void router.navigate("/");
        toast.error("登录已过期,请重新登录");
        return Promise.reject(err);
      }

      // 如果正在刷新，将当前请求加入等待队列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(request(api.request(originalRequest)));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        // refreshToken 从 httpOnly cookie 自动携带
        const result = await refreshTokenApi();
        if (result.success && result.data) {
          const newToken = result.data.accessToken;
          userStore.updateAccessToken(newToken);
          // 用新 token 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          // 刷新完成前可能已有请求返回并进入队列，这里补一次重试
          if (pendingQueue.length > 0) {
            flushQueue(newToken);
          }
          return request(api.request(originalRequest));
        } else {
          flushQueue(null, err);
          userStore.logout();
          void router.navigate("/");
          toast.error("登录已过期,请重新登录");
          return Promise.reject(err);
        }
      } catch (refreshErr) {
        flushQueue(null, refreshErr);
        userStore.logout();
        void router.navigate("/");
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    },
  );

  return {
    get: <T>(url: string, params?: object, config?: AxiosRequestConfig) =>
      request<T>(api.get(url, { params, ...config })),
    post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>(api.post(url, data, config)),
    put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>(api.put(url, data, config)),
    delete: <T>(url: string, config?: AxiosRequestConfig) =>
      request<T>(api.delete(url, config)),
  };
};

export const serverRequest = createApi("/api/v1");
export const aiRequest = createApi("/ai/v1");
