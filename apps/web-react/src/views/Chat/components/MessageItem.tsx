import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { marked } from "marked";
import { sanitizeHtml } from "@/utils/sanitize";
import type { ChatDisplayMessage } from "../types";

interface MessageItemProps {
  item: ChatDisplayMessage;
  avatar: string;
}

/** 对应 Vue 版 Chat/components/MessageItem.vue */
export default function MessageItem({ item, avatar }: MessageItemProps) {
  /**
   * 折叠状态：true = 折叠。
   * 与 Vue 版一致——只有 reasoning（content 为空）时自动展开，
   * 出现正式回复后自动折叠。状态放在单条消息内部，
   * 因此某一条更新不会重置其它消息的折叠状态。
   */
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    setCollapsed(item.content !== "");
  }, [item.content]);

  /**
   * Markdown 渲染结果缓存：
   * useMemo 只依赖本条消息的 content——已完成的消息永久命中缓存，
   * 流式过程中也只解析「正在变化的那一条」，不会每次重渲染全量重解析。
   * （对应 Vue 版的 computed）
   */
  const html = useMemo(() => {
    if (!item.content) return "";
    // marked 解析后再用 DOMPurify 净化，防止 AI 返回的内容触发 XSS
    return sanitizeHtml(marked.parse(item.content) as string);
  }, [item.content]);

  if (item.role === "human") {
    return (
      <div className="mt-5 mr-5 mb-5 flex items-start justify-end gap-4">
        <div className="max-w-[80%] rounded-lg bg-blue-500 p-2 text-sm text-white shadow-md">
          {item.content}
        </div>
        <img
          src={avatar}
          alt="我"
          className="size-[35px] shrink-0 rounded-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="mt-5 mb-5 flex items-start justify-start gap-4">
      <div className="grid size-[35px] shrink-0 place-items-center rounded-full bg-gray-300 text-xs font-medium text-white">
        AI
      </div>
      <div>
        {item.reasoning && (
          <div className="mb-2 max-w-[80%] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <div
              onClick={() => setCollapsed((v) => !v)}
              className="flex cursor-pointer items-center justify-between px-2 py-1 transition-colors hover:bg-gray-100"
            >
              <span className="text-xs text-gray-500">🧠 思考过程</span>
              <ChevronDown
                size={12}
                className={`text-gray-400 transition-transform duration-200 ${
                  collapsed ? "rotate-[-90deg]" : ""
                }`}
              />
            </div>
            {!collapsed && (
              <div className="border-t border-gray-200 p-2 text-[12px] whitespace-pre-wrap text-gray-500">
                {item.reasoning}
              </div>
            )}
          </div>
        )}
        {item.content !== "" && (
          <div
            className="deepseek-markdown max-w-[80%] rounded-lg bg-white p-3 text-sm text-gray-700"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
