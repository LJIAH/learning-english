import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCourseList, getMyCourse } from "@/apis/course";
import { uploadUrl } from "@/apis/request";
import type { Course as CourseItem } from "@en/common/course";
import Tabs from "@/components/Tabs";
import { useLogin } from "@/hooks/useLogin";
import { useUserStore } from "@/stores/user";
import CoursePay from "./components/Pay";

/** 骨架屏 —— 替代 el-skeleton（image + text + button 三种 variant） */
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
      <div className="h-70 animate-pulse bg-gray-200" />
      <div className="p-5">
        <div className="h-4 w-[55%] rounded bg-gray-200 animate-pulse" />
        <div
          className="h-4 w-full rounded bg-gray-200 animate-pulse"
          style={{ marginTop: 12 }}
        />
        <div
          className="h-4 w-[85%] rounded bg-gray-200 animate-pulse"
          style={{ marginTop: 8 }}
        />
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
          <div className="h-4 w-[40%] rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-[15%] rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="mt-4 h-10 w-full rounded-xl bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
}

/** 空状态 —— 替代 el-empty */
function Empty({ description }: { description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
      <div className="mb-3 text-4xl">📚</div>
      <div className="text-sm">{description}</div>
    </div>
  );
}

export default function Course() {
  const navigate = useNavigate();
  const { openLogin } = useLogin();
  const user = useUserStore((s) => s.user);

  const [currentTab, setCurrentTab] = useState("list");
  const [list, setList] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  const [payVisible, setPayVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res =
          currentTab === "list" ? await getCourseList() : await getMyCourse();
        if (!cancelled) setList(res.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentTab]);

  const openPay = async (course: CourseItem) => {
    await openLogin();
    if (currentTab === "list") {
      setSelectedCourse(course);
      setPayVisible(true);
    } else {
      navigate(`/courses/learn/${course.id}/${course.name}`);
    }
  };

  const tabs = [
    { key: "list", label: "精选课程" },
    ...(user?.id ? [{ key: "my", label: "我的课程" }] : []),
  ];

  return (
    <div className="min-h-[60vh] bg-zinc-50/80">
      <div className="w-300 mx-auto px-4 pt-12 pb-24">
        <header className="mb-12 text-center">
          <p className="mb-2 text-sm font-medium tracking-wide text-indigo-600 uppercase">
            Vocabulary Courses
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            精选课程
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">
            一次购买，长期有效 · 覆盖高考、考研、四六级、托福雅思等
          </p>
        </header>

        <Tabs
          value={currentTab}
          items={tabs}
          onChange={(key) => setCurrentTab(key)}
          className="border-b border-zinc-200"
        />

        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty description="暂无课程" />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-all duration-300 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="relative aspect-4/3 overflow-hidden bg-zinc-100">
                  <img
                    src={uploadUrl + item.url}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur">
                    词汇
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="line-clamp-1 text-base font-semibold text-zinc-900">
                    {item.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                    <span className="truncate text-xs text-zinc-400">
                      讲师 {item.teacher}
                    </span>
                    <span className="shrink-0 text-lg font-bold text-indigo-600">
                      ¥{item.price}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openPay(item)}
                    className="mt-4 w-full cursor-pointer rounded-xl border border-indigo-200 bg-white py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                  >
                    {currentTab === "list" ? "购买课程" : "学习课程"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <CoursePay
        open={payVisible}
        course={selectedCourse}
        onClose={() => setPayVisible(false)}
      />
    </div>
  );
}
