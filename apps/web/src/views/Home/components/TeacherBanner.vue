<template>
  <div class="relative w-full h-full overflow-hidden rounded-r-[20px]">
    <img
      src="/images/teacher-home.webp"
      alt="AI 英语外教"
      draggable="false"
      fetchpriority="high"
      decoding="async"
      class="absolute inset-x-0 -top-10 h-[calc(100%+2.5rem)] w-full object-cover object-top-right breathe"
    />
    <!-- 左侧渐变遮罩，使图片自然融入 banner 深色背景 -->
    <div
      class="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/40 to-transparent"
    />
  </div>
</template>

<style scoped>
/* 缓慢的呼吸缩放，替代原先 3D 模型的动效 */
.breathe {
  animation: breathe 8s ease-in-out infinite;
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}
</style>
