<template>
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-800 mb-2">欢迎注册</h1>
    <p class="text-gray-500 text-sm">请填写以下信息以完成注册</p>
  </div>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="80"
    label-position="top"
    class="space-y-6"
  >
    <el-form-item prop="name">
      <el-input
        v-model="form.name"
        placeholder="请输入用户名"
        size="large"
        class="h-12"
        :prefix-icon="User"
      />
    </el-form-item>
    <el-form-item prop="phone">
      <el-input
        v-model="form.phone"
        placeholder="请输入手机号"
        size="large"
        class="h-12"
        :prefix-icon="User"
      />
    </el-form-item>
    <el-form-item prop="email">
      <el-input
        v-model="form.email"
        placeholder="请输入邮箱(可选)"
        size="large"
        class="h-12"
        :prefix-icon="User"
      />
    </el-form-item>
    <el-form-item prop="password">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="请输入密码"
        size="large"
        class="h-12"
        :prefix-icon="Lock"
        show-password
      />
    </el-form-item>
    <el-form-item class="pt-4">
      <el-button
        type="primary"
        size="large"
        class="w-full h-12 text-base font-semibold bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
        @click="handleRegister"
      >
        注册
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { User, Lock } from "@element-plus/icons-vue";
import { register } from "@/apis/user";
import type { UserRegister } from "@en/common/user";
import md5 from "md5";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { useUserStore } from "@/stores/user";
import { useLogin } from "@/hooks/useLogin";

const formRef = useTemplateRef<FormInstance>("formRef");

const form = ref<UserRegister>({
  name: "",
  phone: "",
  email: "",
  password: "",
});

const rules: FormRules = {
  name: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, max: 10, message: "用户名长度为2-10位", trigger: "blur" },
  ],
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号",
      trigger: "blur",
    },
    { min: 11, max: 11, message: "手机号长度为11位", trigger: "blur" },
  ],
  email: [
    {
      // 选填：未填直接通过，填了才校验格式（与后端正则一致）
      validator: (rule, value, callback) => {
        if (!value) return callback();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return callback();
        callback(new Error("请输入正确的邮箱格式"));
      },
      trigger: "blur",
    },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 16, message: "密码长度为6-16位", trigger: "blur" },
  ],
};

const { setUser } = useUserStore();
const { closeLogin } = useLogin();

const handleRegister = async () => {
  await formRef.value?.validate();
  const res = await register({
    ...form.value,
    password: md5(form.value.password),
  });
  if (res.code === 200) {
    console.log(res.data);
    setUser(res.data);
    closeLogin();
    ElMessage.success("注册成功");
  } else {
    ElMessage.error(res.message);
  }
};
</script>
