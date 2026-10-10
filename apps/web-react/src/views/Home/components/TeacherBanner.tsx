/**
 * 对应 Vue 版 Home/components/TeacherBanner.vue。
 *
 * 原先这里是 3D 模型（Three.js），Vue 版已改为静态图 + CSS 呼吸缩放。
 * React 版沿用同一方案；将来接入 3D 时替换此组件即可，不影响页面其余部分。
 *
 * 呼吸动画的 @keyframes 定义在 assets/base.css（Tailwind 任意值无法声明 keyframes）。
 */
export default function TeacherBanner() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-r-[20px]">
      <img
        src="/images/teacher-home.webp"
        alt="AI 英语外教"
        draggable={false}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-x-0 -top-10 h-[calc(100%+2.5rem)] w-full object-cover object-top-right animate-[breathe_8s_ease-in-out_infinite]"
      />
      <div className="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/40 to-transparent" />
    </div>
  );
}
