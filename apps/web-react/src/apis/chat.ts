import type {
  ChatMessageList,
  ChatModeList,
  ChatRoleType,
} from "@en/common/chat";

/**
 * 聊天接口 —— 对应 Vue 版 apis/chat/index.ts，当前为 mock 实现。
 * 类型复用 @en/common/chat。
 */

const MODES: ChatModeList = [
  { id: "m1", label: "口语教练", role: "speaking" },
  { id: "m2", label: "词典模式", role: "dictionary" },
  { id: "m3", label: "应试写作", role: "exam" },
  { id: "m4", label: "外刊精读", role: "news" },
  { id: "m5", label: "沉浸式", role: "immersion" },
];

export async function getChatModeList(): Promise<{
  success: boolean;
  data: ChatModeList;
}> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { success: true, data: MODES };
}

/** mock：返回一条固定的开场白，实际接入时走 aiRequest */
export async function getChatHistory(
  _userId: string,
  role: ChatRoleType,
): Promise<{ success: boolean; data: ChatMessageList }> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const label = MODES.find((m) => m.role === role)?.label ?? "对话";
  return {
    success: true,
    data: [
      {
        role: "ai",
        type: "chat",
        content: `已进入「${label}」模式，直接开始对话即可。`,
      },
    ],
  };
}
