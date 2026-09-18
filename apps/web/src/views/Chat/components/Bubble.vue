<template>
  <div class="flex-1 h-187.5 p-5 bg-purple-50 flex flex-col">
    <div ref="scrollContainer" class="flex-1 overflow-y-auto">
      <MessageItem
        v-for="item in list"
        :key="item.key"
        :item="item"
        :avatar="avatar"
      />
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
import type { ChatDisplayList } from "../types";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { Position, Microphone } from "@element-plus/icons-vue";
import "@/assets/css/deep-seek.css";
import MessageItem from "./MessageItem.vue";
import { useAvatar } from "@/hooks/useAvatar";
import { useVoiceToText } from "@/hooks/useVoiceToText";

const { avatar } = useAvatar();
const { isListening, finalText, interimText, error, start, stop, reset } =
  useVoiceToText();

const props = defineProps<{
  list: ChatDisplayList;
}>();

const message = ref<string>("");
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

// ------------------------------------------------------------------
// 滚动跟随
// 旧实现是每个 SSE chunk 都调一次 scrollIntoView({behavior:'smooth'})，
// 高频调用会让平滑滚动动画不断重启，既卡又浪费；现在改为：
//   1) 节流 100ms
//   2) 直接对滚动容器赋值 scrollTop（瞬时跟随，流式场景本就不适合平滑动画）
//   3) 用户主动上滑查看历史时不再把视图拽回底部
// ------------------------------------------------------------------
const scrollContainer = useTemplateRef<HTMLDivElement>("scrollContainer");
/** 距底部小于该阈值视为“正在跟随最新内容” */
const NEAR_BOTTOM_PX = 80;
/** 滚动节流间隔（ms） */
const SCROLL_THROTTLE_MS = 100;
let scrollLockTimer: ReturnType<typeof setTimeout> | null = null;

const isNearBottom = () => {
  const el = scrollContainer.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
};

const scrollToBottom = (smooth = false) => {
  if (scrollLockTimer !== null) return;
  scrollLockTimer = setTimeout(() => {
    scrollLockTimer = null;
  }, SCROLL_THROTTLE_MS);
  const el = scrollContainer.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
};

// 新增消息（发送 / 切换会话拉取历史）：无论当前在哪个位置，都滚到底部
watch(
  () => props.list.length,
  () => {
    nextTick(() => scrollToBottom(true));
  },
);

// 最后一条消息内容增长（流式输出）：只在用户本来就贴着底部时才跟随
const lastMessageLength = computed(() => {
  const last = props.list[props.list.length - 1];
  return last ? last.content.length + (last.reasoning?.length ?? 0) : 0;
});
watch(lastMessageLength, () => {
  // pre-flush 阶段读取的滚动位置是“内容更新前”的，正是需要的判断时机
  if (isNearBottom()) nextTick(() => scrollToBottom());
});

onBeforeUnmount(() => {
  if (scrollLockTimer !== null) clearTimeout(scrollLockTimer);
});

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
</script>
