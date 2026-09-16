import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

/**
 * 更新用户信息请求 DTO。
 * 字段必填性与 @en/common/user 的 UserUpdate 保持一致：
 * name / isTimingTask 必填，timingTaskTime / email 等选填，
 * 开启定时任务所需的邮箱与时间由 service 按开关状态联动校验。
 */
export class UpdateUserDto {
  @IsString({ message: "用户名必须为字符串" })
  @IsNotEmpty({ message: "用户名不能为空" })
  @Length(2, 20, { message: "用户名长度需为 2-20 个字符" })
  name!: string;

  // 邮箱选填：空串归一成 undefined（表示不更新，避免把库中邮箱覆盖成空串），传了则校验格式
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    return value;
  })
  @IsOptional()
  @IsString({ message: "邮箱必须为字符串" })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "邮箱格式不正确" })
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

  // 定时任务时间选填：空串归一成 undefined（表示不更新，保留库中原值），
  // 是否必须有值由 service 结合 isTimingTask 联动校验
  @Transform(({ value }) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }
    return value;
  })
  // 这里刻意不用 @IsOptional()：它会把 null 也当作"未提供"而跳过校验，
  // 但该字段在库里是非空列（TEXT NOT NULL），null 只会在 Prisma 层抛异常、
  // 被兜底成 500。改成"仅在未提供时跳过校验"，传 null 会明确返回 400。
  @ValidateIf((dto: UpdateUserDto) => dto.timingTaskTime !== undefined)
  @IsString({ message: "定时任务时间必须为字符串" })
  timingTaskTime?: string;
}
