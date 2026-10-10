import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface ThreeSceneOptions {
  /** 宽高比，默认 2（即 width / 2 作为高度）；设为 'container' 则使用容器实际高度 */
  aspectRatio?: number | "container";
  /** 是否启用 OrbitControls 轨道控制器，默认 true */
  enableControls?: boolean;
  /** 自动旋转场景，true 使用默认速度 0.002，或传入 number 自定义速度 */
  autoRotate?: boolean | number;
  /** 相机初始位置，默认 { x: 0, y: 0, z: 10 } */
  cameraPosition?: Partial<{ x: number; y: number; z: number }>;
  /** 每帧动画回调，可用于更新 AnimationMixer 等 */
  onAnimate?: (delta: number) => void;
  /** 场景就绪回调，可用于添加灯光、加载模型等 */
  onReady?: (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
  ) => void;
}

/**
 * Three.js 场景引擎 Hook —— 对应 Vue 版 hooks/useThreeScene.ts（147 行）。
 *
 * 职责：场景 / 相机 / 渲染器 / 轨道控制器 / ResizeObserver / 动画循环 / 销毁清理
 * 不负责模型加载、灯光等业务逻辑，通过 onReady 回调由调用方自行处理。
 *
 * React 移植要点（对应 Vue 的 onMounted/onBeforeUnmount 生命周期）：
 * - 场景只在挂载时创建一次（依赖数组为空）；options 通过 ref 转发，
 *   回调身份变化不会触发 WebGL 场景重建
 * - dispose 幂等：StrictMode 开发期会执行 mount → cleanup → mount，
 *   所有引擎资源在 cleanup 中释放并置空，二次挂载全部重新创建
 */
export function useThreeScene(
  containerRef: RefObject<HTMLDivElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: ThreeSceneOptions = {},
) {
  // options（含 onReady/onAnimate 回调）只进 ref，不进引擎 effect 依赖，
  // 否则每次渲染都会销毁并重建 WebGL 上下文。
  // 声明在引擎 effect 之前：首次挂载时先同步 options，引擎再初始化
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // 引擎资源桥接：effect 闭包内创建，通过 ref 暴露给调用方（与 Vue 版 API 一致）
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const {
      aspectRatio = 2,
      enableControls = true,
      autoRotate = false,
      cameraPosition = { x: 0, y: 0, z: 10 },
    } = optionsRef.current;

    const clock = new THREE.Timer();
    const resolveSize = (el: HTMLDivElement) => {
      const w = el.clientWidth;
      const h = aspectRatio === "container" ? el.clientHeight : w / aspectRatio;
      return { w, h };
    };

    // ---- 引擎资源（局部变量，天然随闭包销毁，无需手动置空判空）----
    const { w: width, h: height } = resolveSize(container);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(
      cameraPosition.x ?? 0,
      cameraPosition.y ?? 0,
      cameraPosition.z ?? 10,
    );

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      precision: "highp",
      powerPreference: "high-performance",
    });
    // 第三个参数 false：仅更新绘图缓冲区，不修改 CSS 宽高，避免锁定响应式尺寸
    renderer.setSize(width, height, false);

    const controls = enableControls
      ? new OrbitControls(camera, renderer.domElement)
      : null;

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate) {
        const speed = typeof autoRotate === "number" ? autoRotate : 0.002;
        scene.rotation.y += speed;
      }

      optionsRef.current.onAnimate?.(delta);
      controls?.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w === 0) return;
        const h =
          aspectRatio === "container"
            ? entry.contentRect.height
            : w / aspectRatio;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(container);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    optionsRef.current.onReady?.(scene, camera, renderer);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      controls?.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
    // 引擎只随挂载创建一次：两个 ref 对象引用稳定，加入依赖仅为满足
    // exhaustive-deps，不会触发重跑
  }, [containerRef, canvasRef]);

  return {
    getScene: () => sceneRef.current,
    getCamera: () => cameraRef.current,
    getRenderer: () => rendererRef.current,
  };
}
