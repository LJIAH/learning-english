import type { AvatarResult, UserUpdate } from "@en/common/user";

/**
 * 用户接口 —— 对应 Vue 版 apis/user/index.ts。
 *
 * 当前为 mock 实现，保留与真实接口一致的入参/出参形状。
 * 类型复用 @en/common/user。
 */

export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function updateUser(
  data: UserUpdate,
): Promise<ApiResult<{ id: string } & UserUpdate>> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { success: true, data: { id: "1", ...data } };
}

export async function uploadAvatar(
  formData: FormData,
): Promise<ApiResult<AvatarResult>> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, message: "未选择文件" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, message: "图片需小于 2MB" };
  }

  // mock：用本地对象 URL 充当上传后的地址
  const previewUrl = URL.createObjectURL(file);
  return {
    success: true,
    data: { previewUrl, databaseUrl: previewUrl },
  };
}
