import { onMounted, onBeforeUnmount, type Ref } from "vue";
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
 * Three.js 场景引擎 Composable
 *
 * 职责：场景 / 相机 / 渲染器 / 轨道控制器 / ResizeObserver / 动画循环 / 销毁清理
 * 不负责模型加载、灯光等业务逻辑，通过 onReady 回调由调用方自行处理。
 */
export function useThreeScene(
  containerRef: Ref<HTMLDivElement | null>,
  canvasRef: Ref<HTMLCanvasElement | null>,
  options: ThreeSceneOptions = {},
) {
  const {
    aspectRatio = 2,
    enableControls = true,
    autoRotate = false,
    cameraPosition = { x: 0, y: 0, z: 10 },
    onAnimate,
    onReady,
  } = options;

  let renderer: THREE.WebGLRenderer | null = null;
  let controls: OrbitControls | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let animationId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const clock = new THREE.Timer();

  const resolveSize = (el: HTMLDivElement) => {
    const w = el.clientWidth;
    const h = aspectRatio === "container" ? el.clientHeight : w / aspectRatio;
    return { w, h };
  };

  const init = () => {
    if (!canvasRef.value || !containerRef.value) return;

    const { w: width, h: height } = resolveSize(containerRef.value);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(
      cameraPosition.x ?? 0,
      cameraPosition.y ?? 0,
      cameraPosition.z ?? 10,
    );

    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
      alpha: true,
      precision: "highp",
      powerPreference: "high-performance",
    });
    // 第三个参数 false：仅更新绘图缓冲区，不修改 CSS 宽高，避免锁定响应式尺寸
    renderer.setSize(width, height, false);

    if (enableControls) {
      controls = new OrbitControls(camera, renderer.domElement);
    }

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate && scene) {
        const speed = typeof autoRotate === "number" ? autoRotate : 0.002;
        scene.rotation.y += speed;
      }

      onAnimate?.(delta);
      controls?.update();
      if (renderer && scene && camera) renderer.render(scene, camera);
    };
    animate();

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w === 0) return;
        const h =
          aspectRatio === "container"
            ? entry.contentRect.height
            : w / aspectRatio;
        renderer?.setSize(w, h, false);
        if (camera) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
      }
    });
    resizeObserver.observe(containerRef.value);

    onReady?.(scene, camera, renderer);
  };

  const dispose = () => {
    if (animationId !== null) cancelAnimationFrame(animationId);
    resizeObserver?.disconnect();
    controls?.dispose();
    renderer?.dispose();
    if (scene) {
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
    }
  };

  onMounted(() => init());
  onBeforeUnmount(() => dispose());

  return {
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
  };
}
