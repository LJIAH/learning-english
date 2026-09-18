<template>
  <!-- appear：组件改为按需挂载（App.vue 中 v-if），需要它保证首次渲染仍播放入场动画 -->
  <Transition name="fade" appear>
    <div
      v-if="isShow"
      class="fixed top-0 left-0 w-full h-full z-40 bg-black opacity-30 blur-sm"
    ></div>
  </Transition>
  <Transition name="modal" appear>
    <div
      v-if="isShow"
      class="fixed inset-0 shadow-lg z-50 p-30 pt-20"
      @click.self="close"
    >
      <div
        v-focus="{ delay: 500 }"
        :class="wordList.length > 0 ? 'rounded-t-lg' : 'rounded-lg'"
        class="flex items-center gap-2 shadow-lg w-1/2 mx-auto p-3 bg-white"
      >
        <el-icon size="20"><Search /></el-icon>
        <input
          type="text"
          v-model="search"
          placeholder="请输入要搜索的单词，例如：apple，按 Esc 键取消"
          class="w-full h-full text-sm border-none rounded-lg p-2 focus:outline-none"
        />
      </div>
      <div
        class="w-1/2 mx-auto max-h-125 border-t border-gray-200 overflow-y-auto"
        v-if="wordList.length > 0"
      >
        <div
          class="bg-white hover:bg-blue-50 text-gray-800 p-4 cursor-pointer shadow-sm hover:shadow-md"
          v-for="item in wordList"
          :key="item.id"
          @click="copyWord(item)"
        >
          <div class="text-sm font-semibold text-blue-600 mb-1">
            {{ item.word }}
          </div>
          <div
            v-safe-html="item.translation"
            class="text-sm text-gray-700 mb-1 overflow-hidden line-clamp-2"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import axios from "axios";
import { getWordBookList } from "@/apis/word-book";
import { Search } from "@element-plus/icons-vue";
import type { Word } from "@en/common/word";
import { ElMessage } from "element-plus";
import { useSearch } from "@/hooks/useSearch";

// 弹窗显隐与 Ctrl+F / Esc 快捷键由 useSearch 统一管理（模块级监听，组件可按需挂载）
const { isShowSearch: isShow, closeSearch } = useSearch();

const search = ref("");
const wordList = ref<Word[]>([]);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

const close = () => {
  search.value = "";
  wordList.value = [];
  closeSearch();
};

const getList = async () => {
  if (!search.value.trim()) {
    wordList.value = [];
    return;
  }
  // 取消上一次未完成的请求，避免旧结果覆盖新结果
  abortController?.abort();
  abortController = new AbortController();
  try {
    const res = await getWordBookList(
      { word: search.value, page: 1, pageSize: 20 },
      { signal: abortController.signal },
    );
    if (res.success) {
      wordList.value = res.data?.list || [];
    }
  } catch (e) {
    // 被主动取消的请求忽略即可
    if (!axios.isCancel(e)) throw e;
  }
};

watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    getList();
  }, 300);
});

const copyWord = (word: Word) => {
  try {
    navigator.clipboard.writeText(word.word); //localhost  / https
    ElMessage.success("复制成功");
  } catch (error) {
    ElMessage.error("复制失败");
  }
};

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  abortController?.abort();
});
</script>

<style scoped>
/* 遮罩层淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 弹窗主体：淡入淡出 + 从上方滑入 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-active > div:first-child,
.modal-leave-active > div:first-child {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:first-child {
  transform: translateY(-30px) scale(0.95);
}
.modal-leave-to > div:first-child {
  transform: translateY(-30px) scale(0.95);
}
</style>
