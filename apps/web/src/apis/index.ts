import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useUserStore } from "@/stores/user";
import router from "@/router";
import { refreshTokenApi } from "./auth";
import { ElMessage } from "element-plus";
export const uploadUrl = import.meta.env.VITE_UPLOAD_URL;
export const socketUrl = import.meta.env.VITE_SOCKET_URL;
export const timeout = 50000;

const request = <T>(p: Promise<unknown>) => p as Promise<Response<T>>;

/** 创建类型安全的请求工具，内置标准响应拦截器 */
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

  // 请求拦截器
  api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const userStore = useUserStore();
      const token = userStore.getAccessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (err) => Promise.reject(err),
  );

  // 响应拦截器
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
        ElMessage.error("网络连接失败,请重试");
        return Promise.reject(err);
      }

      // 无响应（网络错误/超时）或非 401，直接拒绝
      if (!status || status !== 401 || !originalRequest) {
        return Promise.reject(err);
      }

      // 401 token 过期
      const userStore = useUserStore();
      const accessToken = userStore.getAccessToken;
      // 没有 accessToken 说明未登录；refreshToken 由 httpOnly cookie 维护，无需在前端判断
      if (!accessToken) {
        userStore.logout();
        router.push("/");
        ElMessage.error("登录已过期,请重新登录");
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
          // 此时将等待队列有可能为 空，因为请求可能在刷新token完成之前就返回了
          // 所以这里需要判断如果等待队列不为空，则用新token重试等待队列中的请求
          if (pendingQueue.length > 0) {
            flushQueue(newToken);
          }
          return request(api.request(originalRequest));
        } else {
          flushQueue(null, err);
          userStore.logout();
          router.push("/");
          ElMessage.error("登录已过期,请重新登录");
          return Promise.reject(err);
        }
      } catch (refreshErr) {
        flushQueue(null, refreshErr);
        userStore.logout();
        router.push("/");
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

export interface Response<T = unknown> {
  timestamp: string;
  path: string;
  message: string;
  code: number;
  success: boolean;
  data: T | null;
}
