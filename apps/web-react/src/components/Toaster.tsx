import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToastStore, type ToastType } from "@/stores/toast";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-slate-200 bg-white text-slate-700",
};

/**
 * toast 容器 —— 挂在 App 根部，z-index 高于登录弹窗（z-50）。
 * 用 zustand 订阅，无需 Provider/上下文，可渲染在 RouterProvider 之外。
 */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[100] flex flex-col items-center gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${STYLES[t.type]}`}
          >
            <Icon className="size-4 shrink-0" />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
