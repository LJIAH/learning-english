import { aiRequest } from "..";
import type { ChatModeList, ChatRoleType } from "@en/common/chat";

export const getChatModeList = () =>
  aiRequest.get<ChatModeList>("/prompt/list");

export const getChatHistory = (userId: string, role: ChatRoleType) =>
  aiRequest.get("/chat/history", { userId, role });
