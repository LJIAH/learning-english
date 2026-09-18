<template>
  <div class="w-300 mx-auto flex mt-10">
    <Conversations @onGetRole="getRole" />
    <Bubble :list="list" @onSendMessage="sendMessage" />
  </div>
</template>
<script setup lang="ts">
import type {
  ChatDto,
  ChatMessage,
  ChatMessageList,
  ChatRoleType,
} from "@en/common/chat";
import type { ChatDisplayList } from "./types";
import Bubble from "./components/Bubble.vue";
import Conversations from "./components/Conversations.vue";
import { useUserStore } from "@/stores/user";
import { onBeforeUnmount, ref } from "vue";
import { getChatHistory } from "@/apis/chat";
import { CHAT_URL, sse } from "@/apis/sse";

const userStore = useUserStore();
const userId = userStore.user?.id!;
const list = ref<ChatDisplayList>([]);
// 默认值与左侧模式列表第一项保持一致
const role = ref<ChatRoleType | null>("speaking");

// ------------------------------------------------------------------
// 流式节流
// SSE 的 chunk 先写入缓冲区，最多每 STREAM_FLUSH_MS 提交一次到响应式列表。
// 否则每个 token 都会触发一轮“响应式更新 + 渲染 + Markdown 解析”，
// 长对话下会把主线程打满；100ms 的提交频率在观感上与逐字输出无差别。
// ------------------------------------------------------------------
const STREAM_FLUSH_MS = 100;
let contentBuffer = "";
let reasoningBuffer = "";
let flushTimer: ReturnType<typeof setTimeout> | null = null;

let keySeed = 0;
const nextKey = () => `msg-${++keySeed}`;

const flushStream = () => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const last = list.value[list.value.length - 1];
  if (!last) {
    contentBuffer = "";
    reasoningBuffer = "";
    return;
  }
  if (reasoningBuffer) {
    last.reasoning = (last.reasoning ?? "") + reasoningBuffer;
    reasoningBuffer = "";
  }
  if (contentBuffer) {
    last.content += contentBuffer;
    contentBuffer = "";
  }
};

const scheduleFlush = () => {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flushStream, STREAM_FLUSH_MS);
};

const getRole = async (chatRoleType: ChatRoleType) => {
  // console.log(role);
  role.value = chatRoleType;
  const res = await getChatHistory(userId, chatRoleType);
  // 切换模式时丢弃上一条流未提交的缓冲，避免写进新会话
  contentBuffer = "";
  reasoningBuffer = "";
  list.value = (res.data as ChatMessageList).map((item) => ({
    ...item,
    key: nextKey(),
  }));
};

const sendMessage = (
  message: string,
  deepThink: boolean,
  webSearch: boolean,
) => {
  // console.log("send message:", message);
  list.value.push({
    role: "human",
    content: message,
    type: "chat",
    key: nextKey(),
  });
  list.value.push({
    role: "ai",
    content: "",
    reasoning: "",
    type: "chat",
    key: nextKey(),
  });
  sse<ChatMessage, ChatDto>(
    CHAT_URL,
    "POST",
    { role: role.value!, userId, content: message, deepThink, webSearch },
    (data) => {
      // 只有用户主动开启深度思考时，才累加思考过程
      if (data.type === "reasoning" && deepThink) {
        reasoningBuffer += data.content;
        scheduleFlush();
      }
      if (data.type === "chat") {
        contentBuffer += data.content;
        scheduleFlush();
      }
    },
  )
    .catch((err) => {
      // 流被中断：缓冲区里的内容由 finally 提交，已经生成的部分不丢
      console.error("[chat] SSE 连接异常:", err);
    })
    .finally(() => {
      // 结束时立即提交剩余内容，避免最后一个节流窗口的内容丢失
      flushStream();
    });
};

onBeforeUnmount(() => {
  if (flushTimer !== null) clearTimeout(flushTimer);
});
</script>
