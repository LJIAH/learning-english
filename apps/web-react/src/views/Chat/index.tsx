import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatDto, ChatMessage, ChatRoleType } from "@en/common/chat";
import Bubble from "./components/Bubble";
import Conversations from "./components/Conversations";
import { sse, CHAT_URL } from "@/apis/sse";
import { getChatHistory } from "@/apis/chat";
import type { ChatDisplayList } from "./types";
import { useUserStore } from "@/stores/user";

/**
 * 流式节流间隔（ms）
 *
 * SSE 的 chunk 先写入缓冲区，最多每 100ms 提交一次到响应式列表。
 * 否则每个 token 都会触发一轮「状态更新 + 渲染 + Markdown 解析」，
 * 长对话下会把主线程打满；100ms 的提交频率在观感上与逐字输出无差别。
 */
const STREAM_FLUSH_MS = 100;

export default function Chat() {
  const user = useUserStore((s) => s.user);
  const userId = user?.id ?? "";

  const [list, setList] = useState<ChatDisplayList>([]);
  // 默认值与左侧模式列表第一项保持一致
  const [role, setRole] = useState<ChatRoleType | null>("speaking");

  // 缓冲区用 ref 而非 state：写入不触发渲染，只在 flush 时提交一次
  const contentBuffer = useRef("");
  const reasoningBuffer = useRef("");
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keySeed = useRef(0);

  const nextKey = () => `msg-${++keySeed.current}`;

  /** 把缓冲区内容提交到最后一条消息 */
  const flushStream = useCallback(() => {
    if (flushTimer.current !== null) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    // 先取出并清空，再进 setList —— 保证 updater 是纯函数
    const reasoning = reasoningBuffer.current;
    const content = contentBuffer.current;
    reasoningBuffer.current = "";
    contentBuffer.current = "";
    if (!reasoning && !content) return;

    setList((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const next = [...prev];
      next[next.length - 1] = {
        ...last,
        reasoning: reasoning
          ? (last.reasoning ?? "") + reasoning
          : last.reasoning,
        content: content ? last.content + content : last.content,
      };
      return next;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current !== null) return;
    flushTimer.current = setTimeout(flushStream, STREAM_FLUSH_MS);
  }, [flushStream]);

  const getRole = useCallback(
    async (chatRoleType: ChatRoleType) => {
      setRole(chatRoleType);
      // 切换模式时丢弃上一条流未提交的缓冲，避免写进新会话
      contentBuffer.current = "";
      reasoningBuffer.current = "";
      const res = await getChatHistory(userId, chatRoleType);
      setList((res.data ?? []).map((item) => ({ ...item, key: nextKey() })));
    },
    [userId],
  );

  const sendMessage = (
    message: string,
    deepThink: boolean,
    webSearch: boolean,
  ) => {
    if (!userId || !role) return;

    setList((prev) => [
      ...prev,
      { role: "human", content: message, type: "chat", key: nextKey() },
      {
        role: "ai",
        content: "",
        reasoning: "",
        type: "chat",
        key: nextKey(),
      },
    ]);

    sse<ChatMessage, ChatDto>(
      CHAT_URL,
      "POST",
      { role, userId, content: message, deepThink, webSearch },
      (data) => {
        // 只有用户主动开启深度思考时，才累加思考过程
        if (data.type === "reasoning" && deepThink) {
          reasoningBuffer.current += data.content;
          scheduleFlush();
        }
        if (data.type === "chat") {
          contentBuffer.current += data.content;
          scheduleFlush();
        }
      },
    )
      .catch((err: unknown) => {
        // 流被中断：缓冲区里的内容由 finally 提交，已生成的部分不丢
        console.error("[chat] SSE 连接异常:", err);
      })
      .finally(() => {
        // 结束时立即提交剩余内容，避免最后一个节流窗口的内容丢失
        flushStream();
      });
  };

  useEffect(
    () => () => {
      if (flushTimer.current !== null) clearTimeout(flushTimer.current);
    },
    [],
  );

  /**
   * 内联箭头函数会让子组件的「挂载时初始化」副作用每次都重跑
   * （历史上导致模式切换被弹回第一项），这里固定身份。
   */
  const handleGetRole = useCallback(
    (r: ChatRoleType) => {
      void getRole(r);
    },
    [getRole],
  );

  return (
    <div className="mx-auto mt-10 flex w-300">
      <Conversations onGetRole={handleGetRole} />
      <Bubble list={list} onSendMessage={sendMessage} />
    </div>
  );
}
