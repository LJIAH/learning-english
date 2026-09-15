<template>
  <div class="min-h-[60vh] bg-zinc-50/80">
    <div class="w-[1200px] mx-auto px-4 pt-12 pb-24">
      <header class="mb-10 text-center">
        <h1 class="text-3xl font-bold text-zinc-900 tracking-tight sm:text-4xl">
          {{ title }}
        </h1>
        <p class="mt-3 text-zinc-500 text-sm">请根据释义和翻译拼写单词</p>
      </header>

      <el-skeleton v-if="isLoading" :rows="10" animated />

      <div v-if="list.length === 0" class="flex justify-center py-20">
        <el-empty description="暂无单词或您尚未购买该课程" />
      </div>

      <template v-else>
        <!-- 本组已学完 -->
        <div
          v-if="currentIndex >= list.length"
          class="text-center py-16 px-6 bg-white rounded-2xl border border-zinc-100 shadow-sm"
        >
          <p class="text-zinc-600 mb-6">本组 10 个词已学完</p>
          <el-button type="primary" size="large" @click="saveWordMaster">
            再练一组
          </el-button>
        </div>

        <!-- 当前单词卡片 -->
        <div v-else>
          <div
            class="mb-4 flex items-center justify-between text-sm text-zinc-500"
          >
            <span>第 {{ currentIndex + 1 }} / {{ list.length }} 个</span>
            <!-- 记忆倒计时 -->
            <div class="flex items-center gap-2">
              <svg class="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#e4e4e7"
                  stroke-width="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  :stroke="countdown > 5 ? '#6366f1' : '#ef4444'"
                  stroke-width="3"
                  stroke-linecap="round"
                  :stroke-dasharray="100.53"
                  :stroke-dashoffset="100.53 - (100.53 * countdown) / 20"
                  class="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span
                class="font-mono tabular-nums text-xs font-medium"
                :class="countdown > 5 ? 'text-indigo-500' : 'text-red-500'"
              >
                {{ countdown }}s
              </span>
            </div>
          </div>
          <article
            class="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden"
          >
            <div class="p-8 sm:p-10 relative">
              <div class="flex justify-center mb-6">
                <div
                  :class="{ 'filter blur-md select-none': isWordBlurred }"
                  class="transition-all duration-300 min-h-10 flex flex-col items-center text-center"
                >
                  <div
                    class="text-2xl sm:text-3xl font-bold text-indigo-600 tracking-tight"
                  >
                    {{ currentWord?.word }}
                  </div>
                  <div class="flex items-center justify-center gap-2 mt-1">
                    <span
                      v-if="currentWord?.phonetic"
                      class="text-base text-zinc-500 font-mono"
                    >
                      {{ currentWord.phonetic }}
                    </span>
                    <el-icon
                      v-if="currentWord?.word"
                      class="shrink-0 cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors"
                      :size="18"
                      title="发音"
                      @click="playAudio(currentWord!.word)"
                    >
                      <VideoPlay />
                    </el-icon>
                  </div>
                </div>
                <el-icon
                  class="absolute! right-10 top-10 cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors"
                  :size="18"
                  :title="isWordBlurred ? '点击显示单词' : '点击隐藏单词'"
                  @click="isWordBlurred = !isWordBlurred"
                >
                  <View v-if="isWordBlurred" />
                  <Hide v-else />
                </el-icon>
              </div>
              <!-- 释义 -->
              <div
                class="mb-4 rounded-lg bg-zinc-50/80 border border-zinc-100 p-4"
              >
                <p
                  class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2"
                >
                  释义
                </p>
                <div
                  class="text-zinc-700 leading-relaxed prose prose-sm max-w-none"
                  v-safe-html="currentWord?.definition"
                />
              </div>
              <!-- 翻译 -->
              <div class="rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p
                  class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2"
                >
                  翻译
                </p>
                <div
                  class="text-zinc-600 leading-relaxed whitespace-pre-line prose prose-sm max-w-none"
                  v-safe-html="currentWord?.translation"
                />
              </div>
              <!--拼写练习-->
              <div class="rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p
                  class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2"
                >
                  拼写
                </p>
                <div class="flex items-center gap-2 justify-center">
                  <input
                    :maxlength="1"
                    ref="inputRefs"
                    @input="onInput(index)"
                    v-for="(item, index) in wordList"
                    @keydown="onKeyDown(index, $event)"
                    :key="index"
                    type="text"
                    v-model="item.input"
                    :class="{
                      'border-indigo-500!': item.isTrue === true,
                      'border-red-500!': item.isTrue === false,
                    }"
                    class="border-0 border-b-2 border-zinc-300 focus:border-indigo-500 bg-transparent outline-none w-10 text-center text-2xl font-bold"
                  />
                </div>
              </div>
              <!--控制按钮-->
              <div class="flex justify-end gap-2">
                <el-button type="primary" @click="pagePrev"> 上一个 </el-button>
                <el-button type="primary" @click="pageNext"> 下一个 </el-button>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Word } from "@en/common/word";
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { useAudio } from "@/hooks/useAudio";
import { View, Hide, VideoPlay } from "@element-plus/icons-vue";
import { getWordList, saveWordMaster as saveWordMasterApi } from "@/apis/learn";
import { ElMessage } from "element-plus";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

const inputRefs = useTemplateRef<HTMLInputElement[]>("inputRefs");
interface WordItem {
  word: string;
  input: string;
  isTrue: boolean | undefined;
}
const { playAudio } = useAudio({});
const route = useRoute();
const title = route.params.title || "我的课程";
const isLoading = ref(false);
const isWordBlurred = ref(false);
const countdown = ref(20);
let blurTimer: ReturnType<typeof setInterval> | null = null;
const wordList = ref<WordItem[]>([]); // 当前单词的拼写列表如 apple 被拆分成 ['a', 'p', 'p', 'l', 'e']
const list = ref<Word[]>([]);
const currentIndex = ref(0);
const currentWord = computed<Word | undefined>(() => {
  return list.value[currentIndex.value];
});

watch(
  currentWord,
  () => {
    // 清除上一个单词的计时器
    if (blurTimer) {
      clearInterval(blurTimer);
      blurTimer = null;
    }
    // 新单词先显示，重置倒计时
    isWordBlurred.value = false;
    countdown.value = 20;
    // 每秒更新倒计时，20 秒后自动模糊
    blurTimer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        isWordBlurred.value = true;
        if (blurTimer) {
          clearInterval(blurTimer);
          blurTimer = null;
        }
      }
    }, 1_000);
    const current = currentWord.value?.word || "";
    wordList.value = Array.from(current).map((item) => ({
      word: item,
      input: "",
      isTrue: undefined,
    }));
    // 自动聚焦到第一个输入框
    nextTick(() => {
      inputRefs.value?.[0]?.focus();
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  if (blurTimer) clearInterval(blurTimer);
});

// 上一个
const pagePrev = () => {
  if (currentIndex.value === 0) return;
  currentIndex.value--;
};

// 下一个
const pageNext = () => {
  if (wordList.value.some((item) => !item.isTrue)) {
    ElMessage.error("请先输入正确");
    return;
  }
  currentIndex.value++;
};

const saveWordMaster = async () => {
  const wordIds = list.value.map((item) => item.id);
  const res = await saveWordMasterApi(wordIds);
  if (res.success) {
    currentIndex.value = 0;
    getWordListData();
    userStore.updateUserWordNumber(res.data!.wordNumber);
    ElMessage.success(res.message);
  } else {
    ElMessage.error(res.message);
  }
};

const onInput = (index: number) => {
  const current = wordList.value[index];
  if (!current) return;
  current.isTrue = current.word === current.input;
  // 输入正确才自动跳到下一个输入框
  if (current.isTrue) {
    nextTick(() => {
      const inputs = inputRefs.value;
      if (!inputs?.length) return;
      if (index < inputs.length - 1) {
        inputs[index + 1]?.focus();
      }
    });
  }
};

const onKeyDown = (index: number, event: KeyboardEvent) => {
  const current = wordList.value[index];
  if (!current) return;
  if (event.key === "Enter") {
    event.preventDefault();
    pageNext();
    return;
  }
  if (event.key === "Backspace") {
    event.preventDefault();
    if (current.input !== "") {
      // 有内容时只清空，不回跳
      current.input = "";
      current.isTrue = undefined;
    } else {
      // 内容已为空时，回跳到上一个输入框
      current.isTrue = undefined;
      nextTick(() => {
        const inputs = inputRefs.value;
        if (!inputs?.length) return;
        if (index > 0) {
          inputs[index - 1]?.focus();
        }
      });
    }
  }
};

const getWordListData = async () => {
  isLoading.value = true;
  const res = await getWordList(route.params.courseId as string);
  isLoading.value = false;
  if (res.success) {
    list.value = res.data as Word[];
  } else {
    ElMessage.error(res.message);
  }
};

onMounted(() => {
  getWordListData();
});
</script>
