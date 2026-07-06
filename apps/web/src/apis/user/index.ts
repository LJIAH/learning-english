import { serverRequest } from "..";
import type {
  AvatarResult,
  UserLogin,
  UserRegister,
  UserUpdate,
  WebResultUser,
} from "@en/common/user";
// 用户登录
export const login = (data: UserLogin) =>
  serverRequest.post<WebResultUser>("/user/login", data);
// 用户注册
export const register = (data: UserRegister) =>
  serverRequest.post<WebResultUser>("/user/register", data);
// 用户登出（后端吊销 token 并清除 cookie）
export const logout = () => serverRequest.post<null>("/user/logout");
// 用户上传头像
export const uploadAvatar = (data: FormData) =>
  serverRequest.post<AvatarResult>("/user/upload-avatar", data);
// 用户更新信息
export const updateUser = (data: UserUpdate) =>
  serverRequest.post<WebResultUser>("/user/update-user", data);
