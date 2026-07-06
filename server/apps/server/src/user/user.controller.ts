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
import type { UserRegister, UserLogin, UserUpdate } from "@en/common/user";
import { AuthGuard } from "@libs/shared/auth/auth.guard";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 登录：限制 60 秒内最多 5 次请求，防止暴力破解
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  login(
    @Body() loginUserDto: UserLogin,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.login(loginUserDto, res);
  }

  @Post("register")
  register(
    @Body() registerUserDto: UserRegister,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.register(registerUserDto, res);
  }

  // 刷新token：refreshToken 从 httpOnly cookie 读取
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

  // 上传头像
  @Post("upload-avatar")
  @UseInterceptors(FileInterceptor("file")) // 限制前端上传的key为file
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.userService.uploadAvatar(file);
  }

  // 更新用户信息
  @UseGuards(AuthGuard)
  @Post("update-user")
  updateUser(@Body() updateUserDto: UserUpdate, @Req() req: Request) {
    const user = req.user;
    return this.userService.updateUser(updateUserDto, user);
  }
}
