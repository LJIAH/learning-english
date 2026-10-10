import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, EyeOff, Play } from "lucide-react";
import type { Word } from "@en/common/word";
import { getWordList, saveWordMaster } from "@/apis/learn";
import { useAudio } from "@/hooks/useAudio";
import { useUserStore } from "@/stores/user";

interface WordItem {
  word: string;
  input: string;
  isTrue: boolean | undefined;
}

const COUNTDOWN_FROM = 20;
const RING_LENGTH = 100.53; // 2πr，r=16

/** 对应 Vue 版 Course/Learn/index.vue */
export default function Learn() {
  const { title, courseId } = useParams();
  const { playAudio } = useAudio({});
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [isLoading, setIsLoading] = useState(false);
  const [isWordBlurred, setIsWordBlurred] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [wordList, setWordList] = useState<WordItem[]>([]);
  const [list, setList] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const blurTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentWord: Word | undefined = list[currentIndex];

  const fetchList = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    try {
      const res = await getWordList(courseId);
      if (res.success) setList(res.data ?? []);
      else console.error("[learn]", res.message);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // 切换单词：重置倒计时、拆分字母、聚焦首个输入框
  // 对应 Vue 版 watch(currentWord, ..., { immediate: true })
  useEffect(() => {
    if (blurTimer.current) clearInterval(blurTimer.current);

    setIsWordBlurred(false);
    setCountdown(COUNTDOWN_FROM);

    blurTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsWordBlurred(true);
          if (blurTimer.current) clearInterval(blurTimer.current);
          blurTimer.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    const current = currentWord?.word ?? "";
    setWordList(
      Array.from(current).map((ch) => ({
        word: ch,
        input: "",
        isTrue: undefined,
      })),
    );
    inputRefs.current[0]?.focus();

    return () => {
      if (blurTimer.current) clearInterval(blurTimer.current);
      blurTimer.current = null;
    };
  }, [currentWord]);

  const pagePrev = () => {
    if (currentIndex === 0) return;
    setCurrentIndex((i) => i - 1);
  };

  const pageNext = () => {
    if (wordList.some((item) => !item.isTrue)) {
      // TODO: 接入 UI 层后替换为 toast「请先输入正确」
      console.warn("[learn] 请先输入正确");
      return;
    }
    setCurrentIndex((i) => i + 1);
  };

  const onSave = async () => {
    const res = await saveWordMaster(list.map((item) => item.id));
    if (res.success && res.data) {
      setCurrentIndex(0);
      void fetchList();
      if (user) setUser({ ...user, wordNumber: res.data.wordNumber });
    } else {
      console.error("[learn]", res.message);
    }
  };

  const onInput = (index: number, value: string) => {
    const current = wordList[index];
    if (!current) return;
    const isTrue = current.word === value;

    setWordList((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;
      next[index] = { ...item, input: value, isTrue };
      return next;
    });

    if (isTrue && index < wordList.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pageNext();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      const current = wordList[index];
      if (!current) return;
      if (current.input !== "") {
        // 有内容时只清空，不回跳
        setWordList((prev) => {
          const next = [...prev];
          const item = next[index];
          if (!item) return prev;
          next[index] = { ...item, input: "", isTrue: undefined };
          return next;
        });
      } else if (index > 0) {
        // 已为空则回跳上一格
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const ringOffset =
    RING_LENGTH - (RING_LENGTH * countdown) / COUNTDOWN_FROM;
  const ringColor = countdown > 5 ? "#6366f1" : "#ef4444";

  return (
    <div className="min-h-[60vh] bg-zinc-50/80">
      <div className="mx-auto w-[1200px] px-4 pt-12 pb-24">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {title || "我的课程"}
          </h1>
          <p className="mt-3 text-sm text-zinc-500">请根据释义和翻译拼写单词</p>
        </header>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-gray-200"
                style={{ width: `${90 - i * 6}%` }}
              />
            ))}
          </div>
        )}

        {!isLoading && list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <div className="mb-3 text-4xl">📚</div>
            <div className="text-sm">暂无单词或您尚未购买该课程</div>
          </div>
        )}

        {!isLoading && list.length > 0 && currentIndex >= list.length && (
          <div className="rounded-2xl border border-zinc-100 bg-white py-16 px-6 text-center shadow-sm">
            <p className="mb-6 text-zinc-600">本组 {list.length} 个词已学完</p>
            <button
              type="button"
              onClick={() => void onSave()}
              className="cursor-pointer rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              再练一组
            </button>
          </div>
        )}

        {!isLoading && list.length > 0 && currentIndex < list.length && (
          <div>
            <div className="mb-4 flex items-center justify-between text-sm text-zinc-500">
              <span>
                第 {currentIndex + 1} / {list.length} 个
              </span>
              <div className="flex items-center gap-2">
                <svg className="h-6 w-6 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="#e4e4e7"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING_LENGTH}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span
                  className={`font-mono text-xs font-medium tabular-nums ${
                    countdown > 5 ? "text-indigo-500" : "text-red-500"
                  }`}
                >
                  {countdown}s
                </span>
              </div>
            </div>

            <article className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <div className="relative p-8 sm:p-10">
                <div className="mb-6 flex justify-center">
                  <div
                    className={`flex min-h-10 flex-col items-center text-center transition-all duration-300 ${
                      isWordBlurred ? "filter blur-md select-none" : ""
                    }`}
                  >
                    <div className="text-2xl font-bold tracking-tight text-indigo-600 sm:text-3xl">
                      {currentWord?.word}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      {currentWord?.phonetic && (
                        <span className="font-mono text-base text-zinc-500">
                          {currentWord.phonetic}
                        </span>
                      )}
                      {currentWord?.word && (
                        <span title="发音" className="shrink-0">
                          <Play
                            size={18}
                            className="cursor-pointer text-slate-400 transition-colors hover:text-indigo-400"
                            onClick={() => playAudio(currentWord.word)}
                          />
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsWordBlurred((v) => !v)}
                    title={isWordBlurred ? "点击显示单词" : "点击隐藏单词"}
                    className="absolute top-10 right-10 cursor-pointer text-slate-400 transition-colors hover:text-indigo-400"
                  >
                    {isWordBlurred ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">
                    释义
                  </p>
                  <div className="leading-relaxed text-zinc-700">
                    {currentWord?.definition}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">
                    翻译
                  </p>
                  <div className="leading-relaxed whitespace-pre-line text-zinc-600">
                    {currentWord?.translation?.replace(/<[^>]+>/g, "")}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">
                    拼写
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {wordList.map((item, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        maxLength={1}
                        type="text"
                        value={item.input}
                        onChange={(e) => onInput(index, e.target.value)}
                        onKeyDown={(e) => onKeyDown(index, e)}
                        className={`h-12 w-10 border-0 border-b-2 bg-transparent text-center text-2xl font-bold outline-none ${
                          item.isTrue === true
                            ? "border-indigo-500"
                            : item.isTrue === false
                              ? "border-red-500"
                              : "border-zinc-300 focus:border-indigo-500"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={pagePrev}
                    disabled={currentIndex === 0}
                    className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                  >
                    上一个
                  </button>
                  <button
                    type="button"
                    onClick={pageNext}
                    className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-500"
                  >
                    下一个
                  </button>
                </div>
              </div>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
