import type { ReactNode } from "react";

interface FormItemProps {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * 对应 el-form-item（label-width="140px"）—— Tailwind 手写。
 * 只负责「标签 + 内容 + 错误提示」的布局，校验逻辑由调用方持有。
 */
export default function FormItem({
  label,
  error,
  children,
  className = "",
}: FormItemProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <label className="w-35 shrink-0 pt-1.5 text-right text-sm text-slate-700">
        {label}
      </label>
      <div className="min-w-0 flex-1">
        {children}
        {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
      </div>
    </div>
  );
}
