import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Search as SearchIcon } from "lucide-react";
import type { Word } from "@en/common/word";
import { getWordBookList } from "@/apis/word-book";
import { toast } from "@/stores/toast";
import { useSearch } from "@/hooks/useSearch";

/** 防抖间隔 —— 与 Vue 版一致 */
const DEBOUNCE_MS = 300;

/**
 * 全局搜索弹窗 —— 对应 Vue 版 components/Search/index.vue。
 *
 * 显隐与 Ctrl+F / Esc 快捷键由 hooks/useSearch（模块级）统一管理，
 * 所以这里不监听任何快捷键；组件自身由 App.tsx 在 isShowSearch 时按需挂载
 * （懒加载，避免把 axios / 接口层拖进首屏包）。
 */
export default function Search() {
  // 用选择器只订阅 action，避免整个 store 变化都触发本组件重渲染
  const closeSearch = useSearch((s) => s.closeSearch);
  const [keyword, setKeyword] = useState("");
  const [wordList, setWordList] = useState<Word[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 挂载即聚焦（Vue 版用 v-focus 指令，并等 500ms 让动画播完）
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 卸载时收尾：清定时器 + 取消在途请求
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const getList = async (word: string) => {
    // 取消上一次未完成的请求，避免旧结果覆盖新结果
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await getWordBookList(
        { word, page: 1, pageSize: 20 },
        { signal: controller.signal },
      );
      setWordList(res.data?.list ?? []);
    } catch {
      // 被主动取消的请求忽略即可（真实错误交给异常边界，这里不打扰用户）
    }
  };

  // 输入防抖（对应 Vue 的 watch(search)）
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!keyword.trim()) {
      setWordList([]);
      return;
    }
    debounceRef.current = setTimeout(() => void getList(keyword), DEBOUNCE_MS);
  }, [keyword]);

  const close = () => {
    // 关闭时把在途请求一并取消：否则请求回来会往正在卸载的组件里写状态
    abortRef.current?.abort();
    setKeyword("");
    setWordList([]);
    closeSearch();
  };

  const copyWord = async (word: Word) => {
    try {
      await navigator.clipboard.writeText(word.word);
      toast.success("复制成功");
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <>
      {/* 遮罩：z-40，与 Vue 版一致（低于弹窗主体 z-50，高于 sticky header 的 z-10） */}
      <div
        className="search-fade fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        aria-hidden="true"
        onClick={close}
      />

      {/* 弹窗主体：点击空白处关闭（Vue 的 @click.self） */}
      <div className="fixed inset-0 z-50 p-30 pt-20" onClick={close}>
        <div
          className="search-modal mx-auto w-1/2"
          role="dialog"
          aria-modal="true"
          aria-label="搜索单词"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`flex items-center gap-2 bg-white p-3 shadow-lg ${
              wordList.length > 0 ? "rounded-t-lg" : "rounded-lg"
            }`}
          >
            <SearchIcon size={20} className="shrink-0 text-gray-500" />
            <input
              ref={inputRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="请输入要搜索的单词，例如：apple，按 Esc 键取消"
              className="w-full rounded-lg border-none p-2 text-sm outline-none"
            />
          </div>

          {wordList.length > 0 && (
            <div className="max-h-125 overflow-y-auto border-t border-gray-200">
              {wordList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => void copyWord(item)}
                  className="cursor-pointer bg-white p-4 text-gray-800 shadow-sm transition-colors hover:bg-blue-50 hover:shadow-md"
                >
                  <div className="mb-1 text-sm font-semibold text-blue-600">
                    {item.word}
                  </div>
                  <div
                    className="mb-1 line-clamp-2 overflow-hidden text-sm text-gray-700"
                    // translation 来自后端接口，必须净化后再插 DOM
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(item.translation ?? ""),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
