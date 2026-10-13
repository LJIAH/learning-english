/**
 * 3D 全息模型的加载占位。
 *
 * 复用两处：
 *   ① Home 里的 <Suspense fallback> —— three.js chunk 尚未下载完；
 *   ② Hologram 内部 —— chunk 已到，但 GLB 模型（0.49MB）还在下载。
 *
 * ★ 尺寸与真实画布容器**完全一致**（w-full h-full min-h-75 min-w-75）——
 *   实测占位态与模型就绪态的 hero 高度都是 **440.00px**，「占位 → 模型」不产生位移。
 *   **改这里的尺寸前，必须先同步 Hologram 根节点的类名**，否则会引入抖动。
 *   （画布那侧还要额外保持 absolute —— 见 Hologram.tsx 里的说明。）
 *
 * 视觉：深色 hero 上的一枚脉冲光晕 + 旋转细弧。不写文字，避免在首屏抢注意力。
 */
export default function HologramFallback() {
  return (
    <div
      className="relative flex h-full min-h-75 w-full min-w-75 items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="3D 场景加载中"
    >
      {/* 与模型同心的光晕：脉冲呼吸，暗示「正在成形」 */}
      <div className="absolute h-52 w-52 animate-pulse rounded-full bg-indigo-500/30 blur-3xl" />
      {/* 外层静态细环 + 内层旋转弧：给「构建中」一个方向感 */}
      <div className="absolute h-40 w-40 rounded-full border border-indigo-400/15" />
      <div className="absolute h-28 w-28 animate-spin rounded-full border border-indigo-400/25 border-t-indigo-300/80 [animation-duration:2.4s]" />
      {/*
        文字兜底：GLB 有 0.49MB，慢网络下占位会停留数秒 —— 只有一圈细环容易被
        误读成「页面坏了」。这行字是给「停留超过一两秒」的情况准备的。
      */}
      <div className="absolute bottom-10 flex items-center gap-2 text-xs text-indigo-200/70">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-300/80" />
        3D 场景加载中
      </div>
    </div>
  );
}
