import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 对应 el-card（shadow="never"）—— Tailwind 手写，保持与 Vue 版视觉一致 */
export default function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded border border-gray-200 bg-white ${className}`}
    >
      {title !== undefined && (
        <div className="border-b border-gray-100 px-5 py-3.5 font-bold text-slate-800">
          {title}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
