import { IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";

/**
 * 注册请求 DTO。
 * 使用 class 而非 type，以便 class-validator 在运行时做服务端输入验证。
 */
export class RegisterUserDto {
  @IsString({ message: "用户名必须为字符串" })
  @IsNotEmpty({ message: "用户名不能为空" })
  @Length(2, 20, { message: "用户名长度需为 2-20 个字符" })
  name!: string;

  @IsString({ message: "手机号必须为字符串" })
  @IsNotEmpty({ message: "手机号不能为空" })
  @Matches(/^1[3-9]\d{9}$/, { message: "手机号格式不正确" })
  phone!: string;

  @IsOptional()
  @IsString({ message: "邮箱必须为字符串" })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "邮箱格式不正确" })
  email?: string | null;

  @IsString({ message: "密码必须为字符串" })
  @IsNotEmpty({ message: "密码不能为空" })
  @Length(6, 64, { message: "密码长度需为 6-64 个字符" })
  password!: string;
}
