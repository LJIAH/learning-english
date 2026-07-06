import axios from "axios";
import type { Response } from "..";

// 刷新token接口不能携带accessToken，需要单独的实例，防止死循环
const refreshRequest = axios.create({
  baseURL: "/api/v1",
  timeout: 50000,
  withCredentials: true, // 携带 httpOnly cookie 中的 refreshToken
});
refreshRequest.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err),
);

const request = <T>(p: Promise<unknown>) => p as Promise<Response<T>>;

// refreshToken 从 httpOnly cookie 自动携带，无需在请求体中传递
export const refreshTokenApi = () =>
  request<{ accessToken: string }>(refreshRequest.post("/user/refresh-token"));
