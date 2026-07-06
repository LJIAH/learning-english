/// <reference types="multer" />
import { Injectable } from "@nestjs/common";
import type {
  RefreshTokenPayload,
  Token,
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
import type { Request } from "express";
import { updateUserSelect, userSelect } from "./user.select";

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

  // 登录
  async login(loginUserDto: UserLogin) {
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
    // 4.生成token
    const token = this.authService.generateToken({
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
    });
    return this.response.success({ ...updatedUser, token });
  }
  // 注册
  async register(createUserDto: UserRegister) {
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
    const token = this.authService.generateToken({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });

    return this.response.success({ ...newUser, token });
  }
  // 刷新token
  async refreshToken(refreshTokenDto: Omit<Token, "accessToken">) {
    try {
      // 1.检查refreshToken是否有效
      const decoded = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshTokenDto.refreshToken,
      );
      // 2.检查tokenType是否为refresh，防止accessToken冒充
      if (!decoded || decoded.tokenType !== "refresh") {
        return this.response.error(null, "refreshToken无效");
      }
      // 3.查询用户是否存在
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (!user) return this.response.error(null, "用户不存在");
      const token = this.authService.generateToken({
        userId: user.id,
        name: user.name,
        email: user.email,
      });
      return this.response.success(token);
    } catch {
      return this.response.error(null, "refreshToken无效");
    }
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
    const previewUrl = `${protocol}://${endpoint}:${port}${databaseUrl}`; // Preview URL 前端用这个
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
