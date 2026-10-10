import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import md5 from "md5";
import type { UserLogin } from "@en/common/user";
import { login } from "@/apis/user";
import { useLogin } from "@/hooks/useLogin";
import { toast } from "@/stores/toast";
import { useUserStore } from "@/stores/user";
import LoginInput from "./LoginInput";

const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * 登录表单 —— 对应 Vue 版 Login/LoginForm.vue（el-form + rules）。
 * 校验规则逐条对齐，密码同样先 md5 再提交。
 */
export default function LoginForm() {
  const closeLogin = useLogin((s) => s.closeLogin);
  const setUser = useUserStore((s) => s.setUser);

  const [form, setForm] = useState<UserLogin>({ phone: "", password: "" });
  const [errors, setErrors] = useState<
    Partial<Record<keyof UserLogin, string>>
  >({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.phone) next.phone = "请输入手机号";
    else if (!PHONE_RE.test(form.phone)) next.phone = "请输入正确的手机号";
    if (!form.password) next.password = "请输入密码";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await login({ ...form, password: md5(form.password) });
      if (res.code === 200 && res.data) {
        setUser(res.data);
        closeLogin();
        toast.success("登录成功");
      } else {
        toast.error(res.message || "登录失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-800">欢迎回来</h1>
        <p className="text-sm text-gray-500">请登录您的账户以继续</p>
      </div>

      <div className="space-y-6">
        <LoginInput
          icon={<User className="size-4" />}
          placeholder="请输入手机号"
          value={form.phone}
          error={errors.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
            onClick={() => void handleLogin()}
            className="h-12 w-full cursor-pointer rounded border-0 bg-linear-to-r from-indigo-500 to-purple-600 text-base font-semibold text-white transition-all hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </div>
      </div>
    </>
  );
}
