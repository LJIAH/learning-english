import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

/**
 * 更新用户信息请求 DTO。
 * 字段必填性与 @en/common/user 的 UserUpdate 保持一致：
 * name / isTimingTask / timingTaskTime 必填，其余可选。
 */
export class UpdateUserDto {
  @IsString({ message: "用户名必须为字符串" })
  @IsNotEmpty({ message: "用户名不能为空" })
  @Length(2, 20, { message: "用户名长度需为 2-20 个字符" })
  name!: string;

  @IsOptional()
  @IsString({ message: "邮箱必须为字符串" })
  email?: string | null;

  @IsOptional()
  @IsString({ message: "地址必须为字符串" })
  address?: string | null;

  @IsOptional()
  @IsString({ message: "头像必须为字符串" })
  avatar?: string | null;

  @IsOptional()
  @IsString({ message: "签名必须为字符串" })
  bio?: string | null;

  @IsBoolean({ message: "定时任务开关必须为布尔值" })
  @IsNotEmpty({ message: "定时任务开关不能为空" })
  isTimingTask!: boolean;

  @IsString({ message: "定时任务时间必须为字符串" })
  @IsNotEmpty({ message: "定时任务时间不能为空" })
  timingTaskTime!: string;
}
