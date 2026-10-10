import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import md5 from "md5";
import type { UserRegister } from "@en/common/user";
import { register } from "@/apis/user";
import { useLogin } from "@/hooks/useLogin";
import { toast } from "@/stores/toast";
import { useUserStore } from "@/stores/user";
import LoginInput from "./LoginInput";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 注册表单 —— 对应 Vue 版 Login/RegisterForm.vue（el-form + rules）。
 * 校验规则逐条对齐，密码同样先 md5 再提交。
 */
export default function RegisterForm() {
  const closeLogin = useLogin((s) => s.closeLogin);
  const setUser = useUserStore((s) => s.setUser);

  const [form, setForm] = useState<UserRegister>({
    name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof UserRegister, string>>
  >({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name) next.name = "请输入用户名";
    else if (form.name.length < 2 || form.name.length > 10)
      next.name = "用户名长度为2-10位";

    if (!form.phone) next.phone = "请输入手机号";
    else if (!PHONE_RE.test(form.phone)) next.phone = "请输入正确的手机号";

    // 选填：未填直接通过，填了才校验格式（与后端正则一致）
    if (form.email && !EMAIL_RE.test(form.email))
      next.email = "请输入正确的邮箱格式";

    if (!form.password) next.password = "请输入密码";
    else if (form.password.length < 6 || form.password.length > 16)
      next.password = "密码长度为6-16位";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await register({ ...form, password: md5(form.password) });
      if (res.code === 200 && res.data) {
        setUser(res.data);
        closeLogin();
        toast.success("注册成功");
      } else {
        toast.error(res.message || "注册失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-800">欢迎注册</h1>
        <p className="text-sm text-gray-500">请填写以下信息以完成注册</p>
      </div>

      <div className="space-y-6">
        <LoginInput
          icon={<User className="size-4" />}
          placeholder="请输入用户名"
          value={form.name}
          error={errors.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />

        <LoginInput
          icon={<User className="size-4" />}
          placeholder="请输入手机号"
          value={form.phone}
          error={errors.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />

        <LoginInput
          icon={<User className="size-4" />}
          placeholder="请输入邮箱(可选)"
          value={form.email ?? ""}
          error={errors.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />

        <LoginInput
          icon={<Lock className="size-4" />}
          type={showPassword ? "text" : "password"}
          placeholder="请输入密码"
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          suffix={
            <button
              type="button"
              className="cursor-pointer text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </button>
          }
        />

        <div className="pt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleRegister()}
            className="h-12 w-full cursor-pointer rounded border-0 bg-linear-to-r from-indigo-500 to-purple-600 text-base font-semibold text-white transition-all hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "注册中…" : "注册"}
          </button>
        </div>
      </div>
    </>
  );
}
