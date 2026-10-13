import { Fragment, Suspense, lazy, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HologramFallback from "./components/HologramFallback";
import { useLogin } from "@/hooks/useLogin";

/**
 * 首屏 3D 全息模型改为**懒加载**。
 *
 * 原先 Hologram 是同步 import，three.js（含 GLTFLoader / Meshopt 解码器）整包
 * 被拖进首屏主包 —— 主包 301KB(gzip) 里绝大部分是它。改成 lazy 后 three.js
 * 被拆成独立 chunk，首屏渲染完才按需下载，主包回落到 ~105KB(gzip) 量级。
 *
 * 代价是首屏 3D 会「先占位、后出现」。这一段用 <Suspense> 的 fallback 兜住，
 * 尺寸与画布容器完全一致（CLS = 0）；**第二段等待（0.49MB 的 GLB 模型）
 * 由 Hologram 内部的占位层负责**，两段无缝衔接，用户只看到一次加载态。
 */
const Hologram = lazy(() => import("./components/Hologram"));

const STATS = [
  { target: 1000000, suffix: "+", label: "累计学员" },
  { target: 500, suffix: "+", label: "精品课程" },
  { target: 98, suffix: "%", label: "学员满意度" },
  { target: 5000000, suffix: "+", label: "学习时长(小时)" },
];

const ABOUTS = [
  {
    icon: "🖼️",
    title: "AI情境学习",
    content:
      "沉浸式场景模拟，让你在真实语境中自然习得英语，告别枯燥的死记硬背。",
  },
  {
    icon: "🧠",
    title: "智能对话练习",
    content: "AI 实时纠错反馈，个性化对话训练，24小时随时练习口语表达。",
  },
  {
    icon: "🎤",
    title: "科学词汇记忆",
    content: "基于艾宾浩斯遗忘曲线，智能安排复习计划，让单词真正记住。",
  },
];

const formatNumber = (num: number) => num.toLocaleString("en-US");

/**
 * 对应 Vue 版 views/Home/index.vue。
 *
 * 迁移要点（gsap 部分）：
 *   1. Vue 的 onMounted / onBeforeUnmount → useEffect + cleanup
 *   2. Vue 的 reactive 数字滚动 → 改用 ref 直接写 DOM 文本（见下方 onUpdate），
 *      避免为了动画驱动 React 重渲染
 *   3. Vue 的 gsap.context 无 scope，这里显式传入 rootRef 作为作用域，
 *      卸载时一次 revert() 回收全部 ScrollTrigger 实例
 *   4. 动态 import gsap 保持与 Vue 版一致：约 46KB gzip 不进首屏包
 */
export default function Home() {
  const navigate = useNavigate();
  const { openLogin } = useLogin();

  const rootRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // 「立即学习」：未登录先弹登录，登录成功后进入 AI 对话
  const toStudy = async () => {
    try {
      await openLogin();
    } catch {
      return; // 用户取消登录，不跳转
    }
    navigate("/chat");
  };

  const toCourse = () => navigate("/courses");

  useEffect(() => {
    let ctx: { revert: () => void } | null = null;
    let disposed = false;

    /** 动画初始化失败时的兜底：直接展示内容，避免元素停留在隐藏态 */
    const revealAll = () => {
      rootRef.current
        ?.querySelectorAll<HTMLElement>(".home-reveal")
        .forEach((el) => {
          el.style.opacity = "1";
        });
    };

    const initProject = async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        // 等待加载期间组件已被卸载：不再创建动画
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);

        ctx = gsap.context(() => {
          // 数字滚动动画（滚动到可视区域时触发）
          ScrollTrigger.create({
            trigger: statsRef.current!,
            start: "top 90%",
            once: true,
            onEnter: () => {
              STATS.forEach((item, index) => {
                const el = numberRefs.current[index];
                if (!el) return;
                const counter = { value: 0 };
                gsap.to(counter, {
                  value: item.target,
                  duration: 2,
                  ease: "power2.inOut",
                  onUpdate: () => {
                    el.textContent = formatNumber(Math.round(counter.value));
                  },
                });
              });
            },
          });

          // 卡片过渡
          const cards = cardsRef.current?.querySelectorAll("[data-card]") ?? [];
          cards.forEach((card, index) => {
            gsap.fromTo(
              card,
              { opacity: 0, y: 40, scale: 0.98 },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.5,
                delay: 0.2 * index,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: cardsRef.current!,
                  start: "top 75%",
                },
              },
            );
          });

          // 文字过渡
          rootRef.current
            ?.querySelectorAll<HTMLElement>("[data-reveal-text]")
            .forEach((el) => {
              gsap.fromTo(
                el,
                { opacity: 0, y: 60 },
                {
                  opacity: 1,
                  y: 0,
                  scrollTrigger: { trigger: el, start: "top 90%" },
                },
              );
            });
        }, rootRef);
      } catch (err) {
        console.error("[home] 入场动画初始化失败，已直接展示内容:", err);
        revealAll();
      }
    };

    void initProject();

    return () => {
      disposed = true;
      ctx?.revert();
      ctx = null;
    };
  }, []);

  return (
    <div ref={rootRef} className="max-w-300 w-full mx-auto mt-10 pb-30 px-6">
      {/* 背景区域 */}
      <div className="relative flex flex-wrap justify-between rounded-[20px] p-9 min-h-110">
        <div className="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900 to-gray-900/70 rounded-[20px]" />
        <div className="relative z-8 p-8 flex flex-col">
          <span className="text-white text-1xl bg-indigo-500/20 rounded-[100px] px-4 py-2 self-start">
            坚持5天打卡学习
          </span>
          <div className="text-2xl font-bold pt-8 text-indigo-500">
            通过跟AI对话，提高你的英语水平
          </div>
          <div className="text-1xl font-bold pt-5 text-gray-300">
            超1000000学员的选择，提升您的英语能力
          </div>
          <div className="flex items-center gap-4 pt-10">
            <button
              className="bg-indigo-600 text-white rounded-full px-6 py-2.5 cursor-pointer text-sm font-medium w-30 h-10 transition-all duration-200 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
              onClick={() => void toStudy()}
            >
              立即学习
            </button>
            <button
              className="bg-transparent text-indigo-300 border border-indigo-400/50 rounded-full px-6 py-2.5 cursor-pointer text-sm font-medium w-30 h-10 transition-all duration-200 hover:bg-indigo-500/20 hover:text-white active:scale-95"
              onClick={toCourse}
            >
              查看课程
            </button>
          </div>
        </div>
        <div className="relative z-8 flex-1 -my-9 -mr-9">
          {/* fallback 与画布容器同尺寸 → 占位→模型不产生布局位移 */}
          <Suspense fallback={<HologramFallback />}>
            <Hologram />
          </Suspense>
        </div>
      </div>

      {/* 描述区域 */}
      <div className="rounded-[20px] p-10 text-center">
        <div
          data-reveal-text
          className="home-reveal text-2xl font-bold text-gray-800"
        >
          为什么选择我们?
        </div>
        <div
          data-reveal-text
          className="home-reveal text-1xl font-bold text-gray-600 mt-4"
        >
          我们经过科学的验证，AI学习英语的效果比传统学习方式更好，更高效。
        </div>
      </div>

      {/* 数据统计区域 */}
      <div
        ref={statsRef}
        className="py-12 flex flex-wrap items-center justify-between"
      >
        {STATS.map((item, index) => (
          <Fragment key={item.label}>
            <div className="flex-1 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span
                  ref={(el) => {
                    numberRefs.current[index] = el;
                  }}
                  className="text-4xl font-bold text-gray-800"
                >
                  0
                </span>
                <span className="text-2xl font-bold text-indigo-500">
                  {item.suffix}
                </span>
              </div>
              <div className="text-gray-500 mt-2">{item.label}</div>
            </div>
            {index < STATS.length - 1 && (
              <div className="w-px h-16 bg-gray-200" />
            )}
          </Fragment>
        ))}
      </div>

      {/* 核心优势区域 */}
      <div className="relative text-center py-8 mb-6">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="relative z-10">
          <span
            data-reveal-text
            className="home-reveal inline-block px-4 py-1.5 bg-indigo-100 text-indigo-600 text-sm font-medium rounded-full mb-4"
          >
            ✨ 核心优势
          </span>
          <div
            data-reveal-text
            className="home-reveal text-3xl font-bold bg-linear-to-r from-gray-800 via-indigo-700 to-indigo-500 bg-clip-text text-transparent"
          >
            重新定义英语学习方式
          </div>
          <div
            data-reveal-text
            className="home-reveal text-base text-gray-500 mt-4 mx-auto leading-relaxed"
          >
            融合前沿 AI
            技术与语言学研究，打造沉浸式学习体验，让每一分钟的学习都更有价值
          </div>
        </div>
      </div>

      {/* 特性卡片区域 */}
      <div
        ref={cardsRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        style={{ perspective: "1000px" }}
      >
        {ABOUTS.map((item) => (
          <div
            key={item.title}
            data-card
            className="home-reveal group relative overflow-hidden rounded-3xl p-8 cursor-pointer transition-all duration-500 hover:-translate-y-2 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-100 rounded-full blur-2xl group-hover:scale-150 group-hover:bg-indigo-200 transition-all duration-700" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-indigo-50 rounded-full" />

            <div className="relative z-10 w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 group-hover:bg-indigo-200 transition-all duration-300">
              {item.icon}
            </div>

            <div className="relative z-10">
              <div className="text-xl font-bold text-gray-800 mb-3">
                {item.title}
              </div>
              <div className="text-sm text-gray-500 leading-relaxed">
                {item.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
