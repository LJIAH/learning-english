import type { Token } from "@en/common/user";
import axios from "axios";
import type { Response } from "..";

// 刷新token接口不能携带accessToken，需要单独的实例，防止死循环
const refreshRequest = axios.create({
  baseURL: "/api/v1",
  timeout: 50000,
});
refreshRequest.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err),
);

const request = <T>(p: Promise<unknown>) => p as Promise<Response<T>>;

export const refreshTokenApi = (data: Omit<Token, "accessToken">) =>
  request<Token>(refreshRequest.post("/user/refresh-token", data));
