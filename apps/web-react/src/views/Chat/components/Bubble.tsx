import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import MessageItem from "./MessageItem";
import { useAvatar } from "@/hooks/useAvatar";
import type { ChatDisplayList } from "../types";
import "@/assets/css/deep-seek.css";

interface BubbleProps {
  list: ChatDisplayList;
  onSendMessage: (
    message: string,
    deepThink: boolean,
    webSearch: boolean,
  ) => void;
}

/** 距底部小于该阈值视为「正在跟随最新内容」 */
const NEAR_BOTTOM_PX = 80;
/** 滚动节流间隔（ms） */
const SCROLL_THROTTLE_MS = 100;

/** 对应 Vue 版 Chat/components/Bubble.vue */
export default function Bubble({ list, onSendMessage }: BubbleProps) {
  const { avatar } = useAvatar();
  const [message, setMessage] = useState("");
  const [deepThink, setDeepThink] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const scrollContainer = useRef<HTMLDivElement>(null);
  const scrollLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------------
  // 滚动跟随（与 Vue 版同一套策略）
  // 旧实现是每个 SSE chunk 都调 scrollIntoView({behavior:'smooth'})，
  // 高频调用会让平滑动画不断重启，既卡又浪费。现在改为：
  //   1) 节流 100ms
  //   2) 直接对容器赋 scrollTop（流式场景本就不适合平滑动画）
  //   3) 用户主动上滑看历史时不再把视图拽回底部
  // React 里 useEffect 已在 DOM 更新后执行，因此不需要 Vue 的 nextTick。
  // ------------------------------------------------------------------
  const isNearBottom = () => {
    const el = scrollContainer.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const scrollToBottom = (smooth = false) => {
    if (scrollLockTimer.current !== null) return;
    scrollLockTimer.current = setTimeout(() => {
      scrollLockTimer.current = null;
    }, SCROLL_THROTTLE_MS);
    const el = scrollContainer.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // 新增消息（发送 / 拉取历史）：无论当前位置都滚到底部
  useEffect(() => {
    scrollToBottom(true);
  }, [list.length]);

  // 最后一条内容增长（流式输出）：只在贴底时跟随
  const last = list[list.length - 1];
  const lastLength = last
    ? last.content.length + (last.reasoning?.length ?? 0)
    : 0;
  useEffect(() => {
    if (isNearBottom()) scrollToBottom();
  }, [lastLength]);

  useEffect(
    () => () => {
      if (scrollLockTimer.current) clearTimeout(scrollLockTimer.current);
    },
    [],
  );

  const send = () => {
    if (!message || isSending) return;
    setIsSending(true);
    onSendMessage(message, deepThink, webSearch);
    setMessage("");
    // 延迟解锁，防止短时间内重复发送
    setTimeout(() => setIsSending(false), 1000);
  };

  const toggleClass = (on: boolean, onCls: string, offCls: string) =>
    on ? onCls : offCls;

  return (
    <div className="flex h-187.5 flex-1 flex-col bg-purple-50 p-5">
      <div ref={scrollContainer} className="flex-1 overflow-y-auto">
        {list.map((item) => (
          <MessageItem key={item.key} item={item} avatar={avatar} />
        ))}
      </div>

      <div className="box-border flex flex-col gap-3 border-t border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div
            onClick={() => setDeepThink((v) => !v)}
            className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all ${toggleClass(
              deepThink,
              "border-purple-400 bg-purple-100 text-purple-700",
              "border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200",
            )}`}
          >
            <span>🧠</span>
            <span>深度思考</span>
          </div>
          <div
            onClick={() => setWebSearch((v) => !v)}
            className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all ${toggleClass(
              webSearch,
              "border-blue-400 bg-blue-100 text-blue-700",
              "border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200",
            )}`}
          >
            <span>🌐</span>
            <span>联网搜索</span>
          </div>
          {/* TODO: 语音输入（Vue 版是 hooks/useVoiceToText.ts，187 行，
              依赖 Web Speech API 与权限流程，单独迁移） */}
        </div>

        <div className="flex items-center gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="请输入内容"
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={send}
            disabled={isSending}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-indigo-600 text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
