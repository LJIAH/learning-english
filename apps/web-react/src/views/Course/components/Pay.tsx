import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createPay } from "@/apis/pay";
import { uploadUrl } from "@/apis/course";
import type { Course } from "@en/common/course";
import type { CreatePayDto } from "@en/common/pay";

interface CoursePayProps {
  open: boolean;
  course: Course | null;
  onClose: () => void;
}

/** HH:mm:ss —— 替代 el-countdown */
const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

/** 对应 Vue 版 Course/components/Pay.vue */
export default function CoursePay({
  open,
  course,
  onClose,
}: CoursePayProps) {
  const [isPay, setIsPay] = useState(false);
  const [timeExpire, setTimeExpire] = useState(0);
  const [remain, setRemain] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // 倒计时：timeExpire 是绝对过期时间戳
  useEffect(() => {
    stopTimer();
    if (!timeExpire) {
      setRemain(0);
      return;
    }
    setRemain(timeExpire - Date.now());
    timerRef.current = setInterval(() => {
      const left = timeExpire - Date.now();
      if (left <= 0) {
        stopTimer();
        setRemain(0);
        setIsPay(false);
        setTimeExpire(0);
        // TODO: 接入 UI 层后替换为 toast「支付超时，请重新支付」
        console.warn("[pay] 支付超时，请重新支付");
      } else {
        setRemain(left);
      }
    }, 1000);
    return stopTimer;
  }, [timeExpire]);

  const close = () => {
    stopTimer();
    setTimeExpire(0);
    setIsPay(false);
    onClose();
  };

  const onConfirm = async () => {
    const body: CreatePayDto = {
      subject: course?.name ?? "",
      body: course?.description ?? "",
      total_amount: course?.price ?? "",
      courseId: course?.id ?? "",
    };
    const res = await createPay(body);
    if (res.code === 200 && res.data) {
      setIsPay(true);
      window.open(res.data.payUrl, "_blank");
      setTimeExpire(res.data.timeExpire);
    } else {
      // TODO: 接入 UI 层后替换为 toast
      console.error("[pay]", res.message ?? "支付创建失败");
      setIsPay(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="pay-fade fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={close}
      />

      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-xl shadow-indigo-500/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-dialog-title"
      >
        <div className="border-b border-zinc-100 px-6 pt-6 pb-4">
          <h2
            id="pay-dialog-title"
            className="text-lg font-semibold text-zinc-900"
          >
            确认支付
          </h2>
          <p className="mt-1 text-sm text-zinc-500">请核对课程信息后完成支付</p>
        </div>

        {course ? (
          <div className="space-y-4 p-6">
            <div className="flex gap-4 rounded-xl bg-zinc-50/80 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-200">
                <img
                  src={uploadUrl + course.url}
                  alt={course.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">
                  {course.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  讲师 {course.teacher}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-indigo-50/50 px-4 py-3">
              <span className="text-sm text-zinc-600">支付金额</span>
              <span className="text-xl font-bold text-indigo-600">
                ¥{course.price}
              </span>
            </div>

            {timeExpire > 0 && (
              <div className="flex flex-col items-center rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
                <div className="text-xs text-amber-700">支付剩余时间</div>
                <div className="mt-1 font-mono text-lg font-bold text-amber-700">
                  {formatDuration(remain)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-zinc-400">
            暂无课程信息
          </div>
        )}

        <div className="flex gap-3 px-6 pt-2 pb-6">
          <button
            type="button"
            onClick={close}
            className="flex-1 cursor-pointer rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isPay}
            onClick={() => void onConfirm()}
            className="flex-1 cursor-pointer rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPay ? "支付中..." : "确认支付"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
