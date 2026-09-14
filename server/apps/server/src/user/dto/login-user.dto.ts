import { IsNotEmpty, IsString, Matches } from "class-validator";

/**
 * 登录请求 DTO。
 */
export class LoginUserDto {
  @IsString({ message: "手机号必须为字符串" })
  @IsNotEmpty({ message: "手机号不能为空" })
  @Matches(/^1[3-9]\d{9}$/, { message: "手机号格式不正确" })
  phone!: string;

  @IsString({ message: "密码必须为字符串" })
  @IsNotEmpty({ message: "密码不能为空" })
  password!: string;
}
