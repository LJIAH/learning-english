<template>
  <div class="flex-1 h-187.5 p-5 bg-purple-50 flex flex-col">
    <div class="flex-1 overflow-y-auto">
      <div v-for="(item, index) in list" :key="index">
        <div
          class="flex justify-end items-start gap-4 mt-5 mb-5 mr-5"
          v-if="item.role === 'human'"
        >
          <div
            class="text-sm text-white max-w-[80%] rounded-lg p-2 bg-blue-500 shadow-md"
          >
            {{ item.content }}
          </div>
          <div>
            <el-avatar :src="avatar" :size="35" />
          </div>
        </div>
        <div class="flex justify-start items-start gap-4 mt-5 mb-5" v-else>
          <div><el-avatar :size="35">AI</el-avatar></div>
          <div>
            <!-- 思考过程折叠面板 -->
            <div
              v-if="item.role === 'ai' && item.reasoning"
              class="max-w-[80%] mb-2 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
            >
              <div
                @click="toggleReasoning(index)"
                class="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <span class="text-xs text-gray-500">🧠 思考过程</span>
                <el-icon
                  size="12"
                  :class="isReasoningCollapsed[index] ? 'rotate-[-90deg]' : ''"
                  class="transition-transform duration-200 text-gray-400"
                >
                  <arrow-down />
                </el-icon>
              </div>
              <div
                v-show="!isReasoningCollapsed[index]"
                class="text-[12px] text-gray-500 p-2 border-t border-gray-200 whitespace-pre-wrap"
              >
                {{ item.reasoning }}
              </div>
            </div>
            <div
              v-if="item.role === 'ai' && item.content !== ''"
              class="text-sm text-gray-700 max-w-[80%] bg-white rounded-lg p-3 deepseek-markdown"
              v-html="parseMarkdown(item.content)"
            />
          </div>
        </div>
      </div>
      <div ref="chatRef"></div>
    </div>
    <div class="flex p-5 border-t border-gray-200 box-border flex-col gap-3">
      <!-- 功能选项 -->
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-1 px-3 py-1 rounded-full text-xs cursor-pointer transition-all border"
          :class="
            deepThink
              ? 'bg-purple-100 border-purple-400 text-purple-700'
              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
          "
          @click="deepThink = !deepThink"
        >
          <span>🧠</span>
          <span>深度思考</span>
        </div>
        <div
          class="flex items-center gap-1 px-3 py-1 rounded-full text-xs cursor-pointer transition-all border"
          :class="
            webSearch
              ? 'bg-blue-100 border-blue-400 text-blue-700'
              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
          "
          @click="webSearch = !webSearch"
        >
          <span>🌐</span>
          <span>联网搜索</span>
        </div>
        <div class="relative">
          <el-button
            :type="isListening ? 'danger' : 'default'"
            :icon="Microphone"
            circle
            size="small"
            @click="toggleVoice"
            title="语音输入"
          />
          <!-- 收音时脉冲动画 -->
          <span
            v-if="isListening"
            class="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
          >
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
            ></span>
            <span
              class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"
            ></span>
          </span>
        </div>
      </div>
      <div v-if="error" class="text-xs text-red-500">{{ error }}</div>
      <div class="flex items-center gap-2">
        <el-input
          @keyup.enter="sendMessage"
          type="textarea"
          :rows="2"
          v-model="message"
          placeholder="请输入内容"
          class="flex-1 !rounded-xl"
          :input-style="{ borderRadius: '12px', padding: '10px 14px' }"
        />
        <el-button
          :icon="Position"
          type="primary"
          circle
          class="!h-10 !w-10 shadow-md transition-all hover:scale-105 active:scale-95"
          @click="sendMessage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessageList } from "@en/common/chat";
import { nextTick, ref, useTemplateRef, watch } from "vue";
import { ArrowDown } from "@element-plus/icons-vue";
import { Position, Microphone } from "@element-plus/icons-vue";
import { marked } from "marked";
import "@/assets/css/deep-seek.css";
import { useAvatar } from "@/hooks/useAvatar";
import { useVoiceToText } from "@/hooks/useVoiceToText";

const { avatar } = useAvatar();
const { isListening, finalText, interimText, error, start, stop, reset } =
  useVoiceToText();

// 语音识别结果实时同步到输入框
watch([finalText, interimText], () => {
  // console.log('finalText', finalText.value, 'interimText', interimText.value);
  message.value = finalText.value + interimText.value;
});

const toggleVoice = () => {
  if (isListening.value) {
    stop();
  } else {
    // reset();
    start();
  }
};
const deepThink = ref(false);
const webSearch = ref(false);
const emits = defineEmits(["onSendMessage"]);
const chatRef = useTemplateRef<HTMLElement>("chatRef");

const props = defineProps<{
  list: ChatMessageList;
}>();

// 思考过程折叠状态：true=折叠，false=展开
const isReasoningCollapsed = ref<Record<number, boolean>>({});

const toggleReasoning = (index: number) => {
  isReasoningCollapsed.value[index] = !isReasoningCollapsed.value[index];
};

watch(
  () => props.list,
  () => {
    props.list.forEach((item, index) => {
      if (item.role === "ai" && item.reasoning) {
        if (item.content && item.content !== "") {
          // 已有正式回复内容，说明思考结束，自动折叠
          isReasoningCollapsed.value[index] = true;
        } else {
          // 只有 reasoning 没有 content，说明正在思考，自动展开
          isReasoningCollapsed.value[index] = false;
        }
      }
    });
    nextTick(() => {
      chatRef.value?.scrollIntoView({
        behavior: "smooth",
      });
    });
  },
  { deep: true },
);
const message = ref<string>("");
const isSending = ref(false);
const sendMessage = () => {
  if (!message.value || isSending.value) return;
  isSending.value = true;
  emits("onSendMessage", message.value, deepThink.value, webSearch.value);
  message.value = "";
  reset();
  // 延迟解锁，防止短时间内重复发送
  setTimeout(() => {
    isSending.value = false;
  }, 1000);
};
const parseMarkdown = (markdown: string) => {
  if (!markdown) return "";
  return marked.parse(markdown);
};
</script>
