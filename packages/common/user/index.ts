export interface User {
  id: string; // 用户ID
  name: string; // 用户名
  email?: string | null; // 邮箱
  phone: string; // 手机号
  address?: string | null; // 地址
  password: string; // 密码
  bio?: string | null; // 签名
  isTimingTask: boolean; // 是否开启定时任务
  timingTaskTime: string; // 定时任务时间
  avatar?: string | null; // 头像
  wordNumber: number; // 单词数量
  dayNumber: number; // 打卡天数
  createdAt: Date; // 创建时间，ISO字符串或Date
  updatedAt: Date; // 更新时间，ISO字符串或Date
  lastLoginAt?: Date | null; // 最后登录时间，ISO字符串或Date
}

export type UserRegister = Pick<User, "name" | "phone" | "email" | "password">;

export type UserLogin = Pick<User, "phone" | "password">;

export type ResultUser = Omit<User, "password">;
// 用户更新
export type UserUpdate = Pick<
  User,
  | "name"
  | "email"
  | "address"
  | "avatar"
  | "bio"
  | "isTimingTask"
  | "timingTaskTime"
>;

// 头像返回的类型
export type AvatarResult = {
  previewUrl: string;
  databaseUrl: string;
};

export type Token = {
  accessToken: string; // 访问令牌
  refreshToken: string; // 刷新令牌
};

// 前端可见的用户信息：refreshToken 不再下发到前端（改存 httpOnly cookie），只返回 accessToken
export type WebResultUser = ResultUser & {
  accessToken: string;
};
// token的荷载
export type TokenPayload = Pick<User, "name" | "email"> & {
  userId: User["id"];
  // token 版本号，与数据库 tokenVersion 比对，用于吊销与 refreshToken 单次使用
  tokenVersion: number;
};
export type AccessTokenPayload = TokenPayload & { tokenType: "access" };
export type RefreshTokenPayload = TokenPayload & { tokenType: "refresh" };
export type JwtPayload = AccessTokenPayload | RefreshTokenPayload;
