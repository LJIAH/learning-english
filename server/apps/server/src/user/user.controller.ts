import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Req,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserService } from "./user.service";
import type {
  UserRegister,
  UserLogin,
  Token,
  UserUpdate,
} from "@en/common/user";
import { AuthGuard } from "@libs/shared/auth/auth.guard";
import type { Request } from "express";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("login")
  login(@Body() loginUserDto: UserLogin) {
    return this.userService.login(loginUserDto);
  }

  @Post("register")
  register(@Body() registerUserDto: UserRegister) {
    return this.userService.register(registerUserDto);
  }

  // 刷新token
  @Post("refresh-token")
  refreshToken(@Body() refreshTokenDto: Omit<Token, "accessToken">) {
    return this.userService.refreshToken(refreshTokenDto);
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
