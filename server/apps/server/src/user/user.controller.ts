import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserService } from "./user.service";
import { AuthGuard } from "@libs/shared/auth/auth.guard";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { RegisterUserDto } from "./dto/register-user.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 登录：限制 60 秒内最多 5 次请求，防止暴力破解
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.login(loginUserDto, res);
  }

  // 注册：同样限制 60 秒内最多 5 次请求，防止批量注册
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  register(
    @Body() registerUserDto: RegisterUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.register(registerUserDto, res);
  }

  // 刷新token：refreshToken 从 httpOnly cookie 读取；限制频率防止滥用
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("refresh-token")
  refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.userService.refreshToken(req.cookies?.refreshToken, res);
  }

  // 登出：吊销 token 并清除 cookie
  @UseGuards(AuthGuard)
  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.userService.logout(req.user.userId, res);
  }

  // 上传头像：需要登录认证
  @UseGuards(AuthGuard)
  @Post("upload-avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        // 仅允许图片类型，防止上传可执行/恶意文件
        if (!file.mimetype.startsWith("image/")) {
          return cb(new Error("仅允许上传图片文件"), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.userService.uploadAvatar(file);
  }

  // 更新用户信息
  @UseGuards(AuthGuard)
  @Post("update-user")
  updateUser(@Body() updateUserDto: UpdateUserDto, @Req() req: Request) {
    const user = req.user;
    return this.userService.updateUser(updateUserDto, user);
  }
}
