import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/** 对应 el-input —— Tailwind 手写 */
export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`h-8 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 ${className}`}
    />
  );
}

/** 对应 el-input type="textarea" —— Tailwind 手写 */
export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50 ${className}`}
    />
  );
}
