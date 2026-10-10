import { useCallback, useEffect, useState } from "react";
import { Pagination } from "antd";
import DOMPurify from "dompurify";
import { BookOpen, Play } from "lucide-react";
import type { Word, WordQuery } from "@en/common/word";
import { getWordBookList } from "@/apis/word-book";
import { useAudio } from "@/hooks/useAudio";
import AntdProvider from "@/components/AntdProvider";

const FILTERS = [
  { key: "gk", label: "高考" },
  { key: "zk", label: "中考" },
  { key: "gre", label: "GRE" },
  { key: "toefl", label: "TOEFL" },
  { key: "ielts", label: "IELTS" },
  { key: "cet6", label: "六级" },
  { key: "cet4", label: "四级" },
  { key: "ky", label: "考研" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const INITIAL_QUERY: WordQuery = {
  page: 1,
  pageSize: 12,
  word: "",
  gk: false,
  zk: false,
  gre: false,
  toefl: false,
  ielts: false,
  cet6: false,
  cet4: false,
  ky: false,
};

/** 骨架屏 —— 替代 el-skeleton + el-skeleton-item（text / button 两种 variant） */
function CardSkeleton() {
  return (
    <div className="bg-white border border-blue-200 rounded-[10px] p-4 h-55">
      <div className="h-3.5 w-[30%] rounded bg-gray-200 animate-pulse" />
      <div
        className="h-3.5 w-[22%] rounded bg-gray-200 animate-pulse"
        style={{ marginTop: 10 }}
      />
      <div
        className="h-3.5 w-full rounded bg-gray-200 animate-pulse"
        style={{ marginTop: 14 }}
      />
      <div
        className="h-3.5 w-[88%] rounded bg-gray-200 animate-pulse"
        style={{ marginTop: 8 }}
      />
      <div
        className="h-3.5 w-full rounded bg-gray-200 animate-pulse"
        style={{ marginTop: 14 }}
      />
      <div
        className="h-3.5 w-[70%] rounded bg-gray-200 animate-pulse"
        style={{ marginTop: 8 }}
      />
      <div className="mt-4 flex items-center gap-2">
        <div className="h-5 w-10 rounded bg-gray-200 animate-pulse" />
        <div className="h-5 w-13 rounded bg-gray-200 animate-pulse" />
        <div className="h-5 w-10 rounded bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
}

/** 对应 Vue 版 views/WordBook/index.vue */
export default function WordBook() {
  const [query, setQuery] = useState<WordQuery>(INITIAL_QUERY);
  const [list, setList] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { playAudio } = useAudio({});

  const getList = useCallback(async (params: WordQuery) => {
    setLoading(true);
    try {
      const res = await getWordBookList(params);
      if (res.success) {
        setTotal(res.data?.total ?? 0);
        setList(res.data?.list ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void getList(INITIAL_QUERY);
  }, [getList]);

  const searchWord = () => {
    const next = { ...query, page: 1 };
    setQuery(next);
    void getList(next);
  };

  const handlePageChange = (page: number) => {
    const next = { ...query, page };
    setQuery(next);
    void getList(next);
  };

  const toggleFilter = (key: FilterKey) => {
    setQuery((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-300 mx-auto mt-10 bg-linear-to-br from-blue-50 to-indigo-50 rounded-[20px] p-20 shadow-lg">
      <div className="h-20">
        <div className="flex items-center gap-2">
          <BookOpen size={20} color="#2563EB" />
          <span className="text-2xl font-bold text-gray-800">词库列表</span>
        </div>
        <div className="text-sm text-gray-600">
          词典来源：牛津、柯林斯、BNC、FRQ、高考、中考、GRE、TOEFL、IELTS、大学英语六级、大学英语四级、考研
        </div>
      </div>

      <div className="flex items-center mb-10">
        <input
          value={query.word ?? ""}
          onChange={(e) =>
            setQuery((prev) => ({ ...prev, word: e.target.value }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") searchWord();
          }}
          placeholder="请输入单词"
          className="mr-10 h-8 w-64 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus:border-indigo-500"
        />

        {FILTERS.map((f) => (
          <label
            key={f.key}
            className="mr-4 flex cursor-pointer select-none items-center gap-1.5 text-sm text-gray-700"
          >
            <input
              type="checkbox"
              checked={!!query[f.key]}
              onChange={() => toggleFilter(f.key)}
              className="size-4 cursor-pointer accent-indigo-600"
            />
            {f.label}
          </label>
        ))}

        <button
          type="button"
          onClick={searchWord}
          className="ml-10 h-8 cursor-pointer rounded bg-indigo-600 px-5 text-sm text-white transition-colors hover:bg-indigo-500"
        >
          搜索
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {loading
          ? Array.from({ length: query.pageSize }, (_, i) => (
              <CardSkeleton key={`skeleton-${i}`} />
            ))
          : list.map((item) => (
              <div
                key={item.id}
                className="h-55 cursor-pointer rounded-[10px] border border-blue-200 bg-white p-4 text-gray-800 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-md"
              >
                <div className="mb-1 text-sm font-semibold text-blue-600">
                  {item.word}
                </div>
                <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                  {item.phonetic}
                  <Play
                    size={18}
                    color="#2563EB"
                    className="cursor-pointer"
                    onClick={() => playAudio(item.word)}
                  />
                </div>
                <div className="mb-1 line-clamp-2 overflow-hidden text-sm text-gray-700">
                  {item.definition}
                </div>
                <div
                  className="mb-1 line-clamp-2 overflow-hidden text-sm text-gray-600"
                  // translation 来自后端接口，属不可信内容，必须经 DOMPurify 清洗再插 DOM
                  // （对应 Vue 版的 v-safe-html 指令）
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(item.translation ?? ""),
                  }}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  {FILTERS.filter((f) => item[f.key]).map((f) => (
                    <span
                      key={f.key}
                      className="inline-flex h-5 items-center rounded border border-indigo-100 bg-indigo-50 px-1.5 text-xs text-indigo-600"
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
      </div>

      <div className="mt-10 flex justify-center">
        {/*
          用 AntD Pagination 而非手写：它自带页码折叠（省略号 + 首尾页），
          天然免疫「页数上万 → 平铺上万按钮 → 页面卡死」这类问题。
          真实数据 total=770,611 / pageSize=12 → 64,218 页。
          showSizeChanger=false：AntD 在 total>50 时默认显示「每页条数」下拉，
          Vue 版（el-pagination background 模式）没有，关掉才对齐。
        */}
        <AntdProvider>
          <Pagination
            current={query.page}
            pageSize={query.pageSize}
            total={total}
            showSizeChanger={false}
            onChange={handlePageChange}
          />
        </AntdProvider>
      </div>
    </div>
  );
}
