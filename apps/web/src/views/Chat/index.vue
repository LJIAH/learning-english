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
import Bubble from "./components/Bubble.vue";
import Conversations from "./components/Conversations.vue";
import { useUserStore } from "@/stores/user";
import { ref } from "vue";
import { getChatHistory } from "@/apis/chat";
import { CHAT_URL, sse } from "@/apis/sse";

const userStore = useUserStore();
const userId = userStore.user?.id!;
const list = ref<ChatMessageList>([]);
// 默认值与左侧模式列表第一项保持一致
const role = ref<ChatRoleType | null>("speaking");
const getRole = async (chatRoleType: ChatRoleType) => {
  // console.log(role);
  role.value = chatRoleType;
  const res = await getChatHistory(userId, chatRoleType);
  list.value = res.data as ChatMessageList;
};
const sendMessage = (
  message: string,
  deepThink: boolean,
  webSearch: boolean,
) => {
  // console.log("send message:", message);
  list.value.push({ role: "human", content: message, type: "chat" });
  list.value.push({ role: "ai", content: "", reasoning: "", type: "chat" });
  sse<ChatMessage, ChatDto>(
    CHAT_URL,
    "POST",
    { role: role.value!, userId, content: message, deepThink, webSearch },
    (data) => {
      const last = list.value[list.value.length - 1];
      if (last) {
        // 只有用户主动开启深度思考时，才累加思考过程
        if (data.type === "reasoning" && deepThink) {
          last.reasoning += data.content;
        }
        if (data.type === "chat") {
          last.content += data.content;
        }
      }
    },
  );
};
</script>
