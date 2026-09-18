<template>
  <div>
    <!-- 用户消息 -->
    <div
      v-if="item.role === 'human'"
      class="flex justify-end items-start gap-4 mt-5 mb-5 mr-5"
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

    <!-- AI 消息 -->
    <div v-else class="flex justify-start items-start gap-4 mt-5 mb-5">
      <div><el-avatar :size="35">AI</el-avatar></div>
      <div>
        <!-- 思考过程折叠面板 -->
        <div
          v-if="item.reasoning"
          class="max-w-[80%] mb-2 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
        >
          <div
            @click="collapsed = !collapsed"
            class="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <span class="text-xs text-gray-500">🧠 思考过程</span>
            <el-icon
              size="12"
              :class="collapsed ? 'rotate-[-90deg]' : ''"
              class="transition-transform duration-200 text-gray-400"
            >
              <arrow-down />
            </el-icon>
          </div>
          <div
            v-show="!collapsed"
            class="text-[12px] text-gray-500 p-2 border-t border-gray-200 whitespace-pre-wrap"
          >
            {{ item.reasoning }}
          </div>
        </div>
        <div
          v-if="item.content !== ''"
          class="text-sm text-gray-700 max-w-[80%] bg-white rounded-lg p-3 deepseek-markdown"
          v-html="html"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowDown } from "@element-plus/icons-vue";
import { marked } from "marked";
import { sanitizeHtml } from "@/utils/sanitize";
import type { ChatDisplayMessage } from "../types";

const props = defineProps<{
  item: ChatDisplayMessage;
  avatar: string;
}>();

/**
 * 折叠状态：true=折叠。
 * 与原先保持一致——只有 reasoning（content 为空）时自动展开，出现正式回复后自动折叠。
 * 放在单条消息内部后，某一条的更新不会重置其它消息的折叠状态。
 */
const collapsed = ref(true);
watch(
  () => props.item.content,
  (content) => {
    collapsed.value = content !== "";
  },
  { immediate: true },
);

/**
 * Markdown 渲染结果缓存：
 * computed 只依赖本条消息的 content——已完成的消息永久命中缓存，
 * 流式过程中也只解析“正在变化的那一条”，不再像旧实现那样每次重渲染全量重解析。
 */
const html = computed(() => {
  if (!props.item.content) return "";
  // marked 解析后再用 DOMPurify 净化，防止 AI 返回的恶意脚本触发 XSS
  return sanitizeHtml(marked.parse(props.item.content) as string);
});
</script>
