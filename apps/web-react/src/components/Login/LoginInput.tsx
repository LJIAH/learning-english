import type { InputHTMLAttributes, ReactNode } from "react";

interface LoginInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 左侧前置图标（对应 el-input 的 prefix-icon） */
  icon: ReactNode;
  /** 右侧附加内容（如密码显隐切换） */
  suffix?: ReactNode;
  /** 校验错误文案；有值时输入框描边转红 */
  error?: string;
}

/**
 * 登录/注册表单的输入框 —— 对应 el-input size="large" + prefix-icon。
 * 单独写而不复用 components/Input.tsx：后者是 h-8 小尺寸，且无图标/错误态。
 */
export default function LoginInput({
  icon,
  suffix,
  error,
  className = "",
  ...rest
}: LoginInputProps) {
  return (
    <div>
      <div
        className={`relative flex h-12 items-center rounded border bg-white transition-colors ${
          error
            ? "border-red-400"
            : "border-gray-300 focus-within:border-indigo-500"
        }`}
      >
        <span className="pointer-events-none absolute left-3 flex text-gray-400">
          {icon}
        </span>
        <input
          {...rest}
          className={`h-full w-full rounded bg-transparent pl-10 text-base text-gray-700 outline-none placeholder:text-gray-400 ${
            suffix ? "pr-10" : "pr-3"
          } ${className}`}
        />
        {suffix && <span className="absolute right-3 flex">{suffix}</span>}
      </div>
      {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
    </div>
  );
}
