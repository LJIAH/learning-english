/// <reference types="multer" />
import { Injectable } from "@nestjs/common";
import type {
  RefreshTokenPayload,
  UserLogin,
  UserRegister,
  UserUpdate,
} from "@en/common/user";
import { PrismaService, ResponseService } from "@libs/shared";
import { Prisma } from "@libs/shared/generated/prisma/client";
import { AuthService } from "../auth/auth.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { MinioService } from "@libs/shared/minio/minio.service";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { updateUserSelect, userSelect } from "./user.select";

// refreshToken httpOnly cookie 的名称与配置
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天，与 refreshToken 过期时间一致
const REFRESH_COOKIE_PATH = "/api";

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {}

  // 将 refreshToken 写入 httpOnly cookie，避免被 XSS 读取
  private setRefreshCookie(res: Response, refreshToken: string) {
    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  // 登录
  async login(loginUserDto: UserLogin, res: Response) {
    // 1.检查手机号是否存在
    const user = await this.prisma.user.findUnique({
      where: { phone: loginUserDto.phone },
    });
    if (!user) return this.response.error(null, "手机号不存在");
    // 2.检查密码是否正确（前端已做md5，后端用bcrypt二次加密后比较）
    const isMatch = await bcrypt.compare(loginUserDto.password, user.password);
    if (!isMatch) {
      return this.response.error(null, "密码错误");
    }
    // 3.更新最后登录时间
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: userSelect,
    });
    // 4.生成token（携带 tokenVersion，用于吊销/单次使用）
    const { tokenVersion, ...userData } = updatedUser;
    const token = this.authService.generateToken({
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      tokenVersion,
    });
    // refreshToken 写入 httpOnly cookie，不下发到前端
    this.setRefreshCookie(res, token.refreshToken);
    return this.response.success({
      ...userData,
      accessToken: token.accessToken,
    });
  }
  // 注册
  async register(createUserDto: UserRegister, res: Response) {
    // 前端已做md5，后端用bcrypt二次加密后存储
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const data: Prisma.UserCreateInput = {
      name: createUserDto.name,
      phone: createUserDto.phone,
      password: hashedPassword,
      lastLoginAt: new Date(),
    };
    // 1.如果手机号存在，则返回错误
    const phoneUser = await this.prisma.user.findUnique({
      where: { phone: createUserDto.phone },
    });
    if (phoneUser) return this.response.error(null, "手机号已存在");
    // 2.如果用户传入邮箱并且存在了也不行，说明重复了
    if (createUserDto.email) {
      const emailUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });
      if (emailUser) return this.response.error(null, "邮箱已存在");
      data.email = createUserDto.email;
    }
    // 3.创建用户
    const newUser = await this.prisma.user.create({
      data: data,
      // 选择返回的字段
      select: userSelect,
    });
    // 4.生成token
    const { tokenVersion, ...userData } = newUser;
    const token = this.authService.generateToken({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      tokenVersion,
    });
    this.setRefreshCookie(res, token.refreshToken);
    return this.response.success({
      ...userData,
      accessToken: token.accessToken,
    });
  }
  // 刷新token
  async refreshToken(refreshToken: string | undefined, res: Response) {
    try {
      // 1.refreshToken 从 httpOnly cookie 读取
      if (!refreshToken) {
        return this.response.error(null, "refreshToken无效");
      }
      // 2.检查refreshToken是否有效
      const decoded =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);
      // 3.检查tokenType是否为refresh，防止accessToken冒充
      if (!decoded || decoded.tokenType !== "refresh") {
        return this.response.error(null, "refreshToken无效");
      }
      // 4.查询用户是否存在
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (!user) return this.response.error(null, "用户不存在");
      // 5.校验 tokenVersion：登出/刷新后递增，旧 refreshToken 立即失效
      //    实现 refreshToken 单次使用 + 主动吊销
      if (decoded.tokenVersion !== user.tokenVersion) {
        return this.response.error(null, "refreshToken无效");
      }
      // 6.递增 tokenVersion，使本次使用的 refreshToken 立即失效（单次使用）
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      // 7.签发新的 token 对
      const token = this.authService.generateToken({
        userId: user.id,
        name: user.name,
        email: user.email,
        tokenVersion: updated.tokenVersion,
      });
      this.setRefreshCookie(res, token.refreshToken);
      return this.response.success({ accessToken: token.accessToken });
    } catch {
      return this.response.error(null, "refreshToken无效");
    }
  }
  // 登出：递增 tokenVersion 吊销所有已签发 token，并清除 refreshToken cookie
  async logout(userId: string, res: Response) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    this.clearRefreshCookie(res);
    return this.response.success(null);
  }
  // 上传头像
  async uploadAvatar(file: Express.Multer.File) {
    if (!file) return this.response.error(null, "请上传文件");
    if (file.size > 1024 * 1024 * 5) {
      return this.response.error(null, "文件大小不能超过5M");
    }
    // 1.获取minio客户端
    const client = this.minioService.getClient();
    // 2.获取bucket名称
    const bucket = this.minioService.getBucket();
    // 3.文件名称
    const fileName = `${Date.now()}-${file.originalname}`;
    // 4.上传文件
    await client.putObject(bucket, fileName, file.buffer, file.size, {
      "Content-Type": file.mimetype,
    });
    // 5.返回文件url
    const isHttps = !!Number(this.configService.get("MINIO_USE_SSL"));
    const protocol = isHttps ? "https" : "http";
    const port = this.configService.get<number>("MINIO_PORT");
    const endpoint = this.configService.get<string>("MINIO_ENDPOINT");
    const databaseUrl = `/${bucket}/${fileName}`; // Database URL 后面会存到数据库
    // 服务端用 MINIO_ENDPOINT 连接 MinIO，浏览器则通过 MINIO_PUBLIC_URL 访问，
    // 同机部署时这两个地址并不相同（回环地址对浏览器没有意义）
    const publicUrl = this.configService.get<string>("MINIO_PUBLIC_URL");
    const previewUrl = publicUrl
      ? `${publicUrl.replace(/\/+$/, "")}${databaseUrl}` // Preview URL 前端用这个
      : `${protocol}://${endpoint}:${port}${databaseUrl}`; // 未配置对外地址时回退到原逻辑
    return this.response.success({
      previewUrl,
      databaseUrl,
    });
  }
  // 更新用户信息
  async updateUser(updateUserDto: UserUpdate, user: Request["user"]) {
    // 1.检查用户是否存在
    const res = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });
    if (!res) return this.response.error(null, "用户不存在");
    // 2.更新用户信息
    const updatedUser = await this.prisma.user.update({
      where: { id: res.id },
      data: {
        name: updateUserDto.name,
        email: updateUserDto.email,
        address: updateUserDto.address,
        avatar: updateUserDto.avatar,
        bio: updateUserDto.bio,
        isTimingTask: updateUserDto.isTimingTask,
        timingTaskTime: updateUserDto.timingTaskTime,
      },
      select: updateUserSelect,
    });
    return this.response.success(updatedUser);
  }
}
