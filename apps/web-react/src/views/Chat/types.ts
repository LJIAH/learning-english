import type { ChatMessage } from "@en/common/chat";

/** 在领域模型上加一个仅用于列表渲染的 key（Vue 版同构） */
export type ChatDisplayMessage = ChatMessage & { key: string };
export type ChatDisplayList = ChatDisplayMessage[];
