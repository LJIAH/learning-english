import type {
  ChatMessageList,
  ChatModeList,
  ChatRoleType,
} from "@en/common/chat";
import { aiRequest } from "./request";

/** 聊天接口 —— 对应 Vue 版 apis/chat/index.ts（走 AI 服务 /ai/v1）。 */

export const getChatModeList = () =>
  aiRequest.get<ChatModeList>("/prompt/list");

export const getChatHistory = (userId: string, role: ChatRoleType) =>
  aiRequest.get<ChatMessageList>("/chat/history", { userId, role });
