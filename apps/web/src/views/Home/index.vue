<template>
  <div ref="homeRoot" class="max-w-300 w-full mx-auto mt-10 pb-30 px-6">
    <!-- 🎯 背景区域 -->
    <div
      class="relative flex flex-wrap justify-between rounded-[20px] p-9 min-h-110"
    >
      <div
        class="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900 to-gray-900/70 rounded-[20px]"
      />
      <div class="relative z-8 p-8 flex flex-col">
        <span
          class="text-white text-1xl bg-indigo-500/20 rounded-[100px] px-4 py-2"
          >坚持5天打卡学习</span
        >
        <div class="text-2xl font-bold pt-8 text-l text-indigo-500">
          通过跟AI对话，提高你的英语水平
        </div>
        <div class="text-1xl font-bold pt-5 text-gray-300">
          超1000000学员的选择，提升您的英语能力
        </div>
        <div class="flex items-center gap-4 pt-10">
          <button
            class="bg-indigo-600 text-white rounded-full px-6 py-2.5 cursor-pointer text-sm font-medium w-30 h-10 transition-all duration-200 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
            @click="toStudy"
          >
            立即学习
          </button>
          <button
            class="bg-transparent text-indigo-300 border border-indigo-400/50 rounded-full px-6 py-2.5 cursor-pointer text-sm font-medium w-30 h-10 transition-all duration-200 hover:bg-indigo-500/20 hover:text-white active:scale-95"
            @click="toCourse"
          >
            查看课程
          </button>
        </div>
      </div>
      <div class="relative z-8 flex-1 -my-9 -mr-9">
        <TeacherBanner />
      </div>
    </div>

    <!-- 📖 描述区域 -->
    <div class="rounded-[20px] p-10 text-center">
      <div ref="textWhy" class="home-reveal text-2xl font-bold text-gray-800">
        为什么选择我们?
      </div>
      <div
        ref="textWhyContent"
        class="home-reveal text-1xl font-bold text-gray-600 mt-4"
      >
        我们经过科学的验证，AI学习英语的效果比传统学习方式更好，更高效。
      </div>
    </div>

    <!-- 📊 数据统计区域 -->
    <div
      ref="statsSection"
      class="py-12 flex flex-wrap items-center justify-between"
    >
      <template v-for="(item, index) in stats" :key="item.label">
        <div class="flex-1 text-center">
          <div class="flex items-baseline justify-center gap-1">
            <span class="text-4xl font-bold text-gray-800">{{
              formatNumber(item.value)
            }}</span>
            <span class="text-2xl font-bold text-indigo-500">{{
              item.suffix
            }}</span>
          </div>
          <div class="text-gray-500 mt-2">{{ item.label }}</div>
        </div>
        <div v-if="index < stats.length - 1" class="w-px h-16 bg-gray-200" />
      </template>
    </div>

    <!-- ✨ 核心优势区域 -->
    <div class="relative text-center py-8 mb-6">
      <!-- 装饰性光晕背景 -->
      <div
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl"
      />
      <div class="relative z-10">
        <span
          ref="textCore"
          class="home-reveal inline-block px-4 py-1.5 bg-indigo-100 text-indigo-600 text-sm font-medium rounded-full mb-4"
          >✨ 核心优势</span
        >
        <div
          ref="coreTitle"
          class="home-reveal text-3xl font-bold bg-linear-to-r from-gray-800 via-indigo-700 to-indigo-500 bg-clip-text text-transparent"
        >
          重新定义英语学习方式
        </div>
        <div
          ref="coreContent"
          class="home-reveal text-base text-gray-500 mt-4 mx-auto leading-relaxed"
        >
          融合前沿 AI
          技术与语言学研究，打造沉浸式学习体验，让每一分钟的学习都更有价值
        </div>
      </div>
    </div>

    <!-- 🃏 特性卡片区域 -->
    <div
      ref="cardsContainer"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      style="perspective: 1000px"
    >
      <div
        v-for="(item, index) in abouts"
        :key="item.title"
        data-card
        class="home-reveal group relative overflow-hidden rounded-3xl p-8 cursor-pointer transition-all duration-500 hover:-translate-y-2 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10"
      >
        <!-- 装饰性背景图案 -->
        <div
          class="absolute -right-8 -top-8 w-32 h-32 bg-indigo-100 rounded-full blur-2xl group-hover:scale-150 group-hover:bg-indigo-200 transition-all duration-700"
        />
        <div
          class="absolute -left-4 -bottom-4 w-24 h-24 bg-indigo-50 rounded-full"
        />

        <!-- 图标区域 -->
        <div
          class="relative z-10 w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 group-hover:bg-indigo-200 transition-all duration-300"
        >
          {{ item.icon }}
        </div>

        <!-- 内容区域 -->
        <div class="relative z-10">
          <div class="text-xl font-bold text-gray-800 mb-3">
            {{ item.title }}
          </div>
          <div class="text-sm text-gray-500 leading-relaxed">
            {{ item.content }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, useTemplateRef } from "vue";
import { useRouter } from "vue-router";
import TeacherBanner from "./components/TeacherBanner.vue";
import { useLogin } from "../../hooks/useLogin";

const { openLogin } = useLogin();

const toStudy = () => {
  openLogin().then(() => {
    console.log("Login opened");
  });
};

// 跳转到课程列表页
const router = useRouter();
const toCourse = () => {
  router.push("/courses");
};

const homeRoot = useTemplateRef<HTMLDivElement>("homeRoot");
const statsSection = useTemplateRef<HTMLDivElement>("statsSection");
const textWhy = useTemplateRef<HTMLDivElement>("textWhy");
const textWhyContent = useTemplateRef<HTMLDivElement>("textWhyContent");
const textCore = useTemplateRef<HTMLSpanElement>("textCore");
const coreTitle = useTemplateRef<HTMLDivElement>("coreTitle");
const coreContent = useTemplateRef<HTMLDivElement>("coreContent");
const cardsContainer = useTemplateRef<HTMLDivElement>("cardsContainer");

const formatNumber = (num: number) => {
  return num.toLocaleString("en-US");
};

const stats = reactive([
  { value: 0, suffix: "+", label: "累计学员", target: 1000000 },
  { value: 0, suffix: "+", label: "精品课程", target: 500 },
  { value: 0, suffix: "%", label: "学员满意度", target: 98 },
  { value: 0, suffix: "+", label: "学习时长(小时)", target: 5000000 },
]);

const abouts = [
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

// ------------------------------------------------------------------
// gsap 改为动态加载：约 46KB gzip 移出首屏包。
// 同时修复原实现的泄漏——旧代码只在 onMounted 里创建动画、没有清理，
// 离开首页后 ScrollTrigger 实例与滚动监听会一直残留，再次进入还会叠加。
// 现在用 gsap.context 统一收集，卸载时 revert() 一次性回收。
// ------------------------------------------------------------------
let gsapCtx: { revert: () => void } | null = null;
let disposed = false;

/** 动画初始化失败时的兜底：直接展示内容，避免元素停留在隐藏态 */
const revealAll = () => {
  homeRoot.value
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

    gsapCtx = gsap.context(() => {
      // 数字滚动动画（滚动到可视区域时触发）
      ScrollTrigger.create({
        trigger: statsSection.value!,
        start: "top 90%",
        once: true,
        onEnter: () => {
          stats.forEach((item) => {
            gsap.to(item, {
              value: item.target,
              duration: 2,
              ease: "power2.inOut",
              snap: { value: 1 },
            });
          });
        },
      });
      // 卡片过渡
      const cards = cardsContainer.value?.querySelectorAll("[data-card]") ?? [];
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
              trigger: cardsContainer.value!,
              start: "top 75%",
            },
          },
        );
      });
      // 文字过渡
      gsap.fromTo(
        textWhy.value!,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: { trigger: textWhy.value!, start: "top 90%" },
        },
      );
      gsap.fromTo(
        textWhyContent.value!,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: { trigger: textWhyContent.value!, start: "top 90%" },
        },
      );
      gsap.fromTo(
        textCore.value!,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: { trigger: textCore.value!, start: "top 75%" },
        },
      );
      gsap.fromTo(
        coreTitle.value!,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: { trigger: coreTitle.value!, start: "top 75%" },
        },
      );
      gsap.fromTo(
        coreContent.value!,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: { trigger: coreContent.value!, start: "top 75%" },
        },
      );
    });
  } catch (err) {
    console.error("[home] 入场动画初始化失败，已直接展示内容:", err);
    revealAll();
  }
};

onMounted(() => {
  void initProject();
});

onBeforeUnmount(() => {
  disposed = true;
  gsapCtx?.revert();
  gsapCtx = null;
});
</script>

<style scoped>
/* 入场动画元素的初始隐藏态：
   避免 gsap 动态加载期间元素“先显示、加载完又被设为透明”造成闪烁。
   gsap 动画结束时会写入内联 opacity，优先级高于这里 */
.home-reveal {
  opacity: 0;
}
</style>
