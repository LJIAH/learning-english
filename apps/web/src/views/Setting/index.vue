<template>
  <div class="mx-auto w-300 px-4 py-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-xl font-extrabold text-slate-900">设置</div>
        <div class="mt-1 text-sm text-slate-500">
          在这里修改你的个人信息与头像
        </div>
      </div>

      <div class="flex gap-2">
        <el-button>重置</el-button>
        <el-button @click="onSave" type="primary">保存</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mt-4">
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>
            <div class="font-bold">头像</div>
          </template>

          <div class="flex items-center gap-4">
            <img
              class="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              :src="previewUrl || avatar"
              loading="lazy"
              referrerpolicy="no-referrer"
            />

            <div class="flex flex-col gap-2">
              <el-upload
                :show-file-list="false"
                :auto-upload="false"
                accept="image/*"
                :on-change="onAvatarSelect"
              >
                <el-button type="primary">选择头像</el-button>
              </el-upload>

              <div class="text-xs text-slate-500">
                支持 png/jpg/webp，建议小于 2MB
              </div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="mt-4">
          <template #header>
            <div class="font-bold">账号</div>
          </template>

          <div class="text-sm text-slate-600">
            <div class="flex items-center justify-between">
              <span>登录状态</span>
              <el-tag type="success"> 已登录 </el-tag>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="font-bold">个人信息</div>
          </template>

          <el-form
            label-width="140px"
            :model="form"
            :rules="rules"
            ref="formRef"
            status-icon
          >
            <el-form-item label="用户名：" prop="name">
              <el-input
                v-model="form.name"
                placeholder="请输入用户名"
                clearable
              />
            </el-form-item>

            <el-form-item label="邮箱：" prop="email">
              <el-input
                v-model="form.email"
                placeholder="请输入邮箱"
                clearable
              />
            </el-form-item>

            <el-form-item label="定时任务：" prop="isTimingTask">
              <el-switch v-model="form.isTimingTask" />
            </el-form-item>
            <el-form-item label="定时任务时间：" prop="timingTaskTime">
              <div>
                <el-time-picker
                  format="HH:mm:ss"
                  value-format="HH:mm:ss"
                  v-model="form.timingTaskTime"
                  placeholder="请选择定时任务时间"
                  :disabled="!form.isTimingTask"
                />
                <div class="text-xs text-slate-500 mt-3">
                  tips:开启定时任务需要先填写邮箱，用于接收每日打卡提醒
                </div>
              </div>
            </el-form-item>

            <el-form-item label="地址：" prop="address">
              <el-input
                v-model="form.address"
                placeholder="请输入地址"
                clearable
              />
            </el-form-item>

            <el-form-item label="签名：" prop="bio">
              <el-input
                v-model="form.bio"
                placeholder="写点什么介绍一下自己"
                type="textarea"
                :rows="4"
                maxlength="120"
                show-word-limit
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="mt-4">
          <template #header>
            <div class="font-bold">危险操作</div>
          </template>

          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-900">退出登录</div>
              <div class="text-sm text-slate-500">清除本地登录状态</div>
            </div>
            <el-button @click="logout" type="danger" plain> 退出 </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import type { UserUpdate } from "@en/common/user";
import {
  ElMessage,
  type FormInstance,
  type FormRules,
  type UploadFile,
} from "element-plus";
import { onMounted, ref, useTemplateRef, watch } from "vue";
import avatar from "@/assets/images/avatar/default-avatar.webp";
import { useUserStore } from "@/stores/user";
import { updateUser, uploadAvatar } from "@/apis/user";
import { useAvatar } from "@/hooks/useAvatar";
import { useLogin } from "@/hooks/useLogin";
const { logout } = useLogin();
const { customAvatar } = useAvatar();
const userStore = useUserStore();
const previewUrl = ref<string | null>(null);
const formRef = useTemplateRef<FormInstance>("formRef"); //表单ref

const form = ref<UserUpdate>({
  name: "",
  email: "",
  address: "",
  bio: "",
  isTimingTask: false,
  timingTaskTime: "",
  avatar: "",
});
const rules: FormRules = {
  name: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  email: [
    {
      // 与定时任务联动：开启时邮箱必填（学习报告的投递地址），关闭时选填；填了则校验格式
      validator: (rule, value, callback) => {
        if (!value) {
          if (form.value.isTimingTask) {
            return callback(
              new Error("开启定时任务后需要填写邮箱以接收打卡提醒")
            );
          }
          return callback();
        }
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return callback();
        callback(new Error("请输入正确的邮箱格式"));
      },
      trigger: ["blur", "change"],
    },
  ],
  // isTimingTask 是开关（恒有 true/false，不存在空值），无需 required 规则
  timingTaskTime: [
    {
      // 与定时任务开关联动：开启时必选时间，关闭时选填
      validator: (rule, value, callback) => {
        if (!value) {
          if (form.value.isTimingTask) {
            return callback(new Error("开启定时任务后需要选择任务时间"));
          }
          return callback();
        }
        callback();
      },
      trigger: ["blur", "change"],
    },
  ],
};

const onSave = async () => {
  await formRef.value?.validate();
  const res = await updateUser(form.value);
  if (res.success && res.data) {
    userStore.updateUser(res.data); //更新用户信息
    ElMessage.success("更新成功");
  } else {
    ElMessage.error(res.message);
  }
};
// 定时任务开关切换时重新校验邮箱和时间，让「开启需填写」的提示即时出现/消失
watch(
  () => form.value.isTimingTask,
  () => {
    formRef.value?.validateField("email").catch(() => {});
    formRef.value?.validateField("timingTaskTime").catch(() => {});
  }
);

const onAvatarSelect = async (file: UploadFile) => {
  // form.value.avatar = file.url || URL.createObjectURL(file.raw);
  const formData = new FormData();
  formData.append("file", file.raw as File);
  const res = await uploadAvatar(formData);
  if (res.success && res.data) {
    form.value.avatar = res.data?.databaseUrl;
    previewUrl.value = res.data?.previewUrl;
  } else {
    ElMessage.error(res.message);
  }
};

const init = () => {
  if (userStore.getUser) {
    form.value = userStore.getUpdateUserInfo;
    previewUrl.value = customAvatar(form.value.avatar!);
  }
};
onMounted(() => {
  init();
});
</script>
