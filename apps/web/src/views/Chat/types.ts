import type { ChatMessage } from "@en/common/chat";

/**
 * 列表渲染用的消息类型：在共享类型 ChatMessage 上附加稳定 key。
 *
 * 不直接改 @en/common 的 ChatMessage，是为了不动前后端共享契约；
 * key 仅用于 Vue 列表渲染（替代原先的 index），保证追加消息时 DOM 复用正确。
 */
export type ChatDisplayMessage = ChatMessage & { key: string };

export type ChatDisplayList = ChatDisplayMessage[];
