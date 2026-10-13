import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useThreeScene } from "@/hooks/useThreeScene";
import HologramFallback from "./HologramFallback";

/** 优化后的模型：4.84MB → 0.49MB（9.8x）。生成方式见 scripts/optimize-models.mjs */
const MODEL_URL = "/models/hologram/scene.opt.glb";

/** 模型在画面中的目标占比（水平方向最宽时），留一点余量 */
const FILL_RATIO = 0.88;

/** 释放 GLTF 场景树上的几何体与材质（模型加载完成前组件已被卸载时兜底） */
const disposeObject3D = (root: THREE.Object3D) => {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
};

/**
 * 对应 Vue 版 Home/components/Hologram.vue。
 *
 * 首屏 3D 全息模型：环境光 + 平行光，GLTF 加载后播放全部动画，
 * 场景缓慢自转（autoRotate 0.002），其余引擎能力（相机/控制器/Resize/销毁）
 * 全部由 useThreeScene 承担。
 *
 * 模型文件不入库（见根 .gitignore），需从本地源拷贝到
 * public/models/hologram/ 后方可显示。
 */
export default function Hologram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  /** 模型水平最远点到 y 轴的距离（绕 y 自转下不变），加载后实测 */
  const radiusRef = useRef(0);
  /** 模型垂直半高 */
  const halfHeightRef = useRef(0);

  /**
   * 模型是否已就绪（GLB 下载 + 解析 + 相机适配完成）。
   *
   * 拆成两个状态是为了「先淡出、再卸载」：`loaded` 置 true 只触发占位层的
   * opacity 过渡，过渡结束（onTransitionEnd）才把占位从 DOM 摘掉。
   * 若只用一个状态直接条件渲染，占位会瞬间消失、而模型此刻才刚渲染出来，
   * 中间会闪一下深色底。
   */
  const [loaded, setLoaded] = useState(false);
  const [placeholderGone, setPlaceholderGone] = useState(false);

  const { getScene, getCamera } = useThreeScene(containerRef, canvasRef, {
    /**
     * 画布跟随容器高度，而不是默认的 2:1。
     *
     * 默认 aspectRatio=2 时画布高度由**列宽**算出（690/2 = 345），而右列实际高 441
     * —— 底部白白空出 96px，且窗口越窄画布越矮、空得越多（不响应式）。
     * 改成 'container' 后画布铺满右列，模型自然居中。
     */
    aspectRatio: "container",
    autoRotate: 0.002,
    onAnimate: (delta) => {
      mixerRef.current?.update(delta);
    },
    onReady: (scene) => {
      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 10, 7.5);
      scene.add(directionalLight);
    },
  });

  useEffect(() => {
    const scene = getScene();
    if (!scene) return;

    // active 是 effect 局部变量：StrictMode 双挂载时，第一次挂载的
    // cleanup 先把它置 false，迟到的加载回调会走资源释放分支，不会泄漏
    let active = true;

    /**
     * 按「模型尺寸 + 当前画布宽高比」解析求相机距离。
     *
     * 为什么不能写死：垂直 FOV 固定 75°，可见范围只由距离决定，而画布宽高比
     * 随视口变化（宽屏 ≈1.57，窄屏会到 1.1）。写死距离时窄屏下模型会被左右裁掉。
     *
     * 场景绕 y 轴自转 ⇒ 水平投影随角度变化，用旋转不变量 ρ（点到 y 轴的距离）
     * 推最坏情况：设模型上某点水平距轴 ρ、高度 y，投影到画布的归一化坐标为
     *     ndcX = ρ / (√(d² − ρ²) · tan(fov/2) · aspect)
     * 令 ndcX ≤ FILL_RATIO 反解得
     *     d ≥ ρ · √(1 + 1/(FILL_RATIO · tan(fov/2) · aspect)²)
     * 垂直方向同理，取两者较大值。
     *
     * ★ 注意别用「包围盒尺寸 / 距离」的朴素算法：模型有 4.5 的 z 向半深，
     *   靠近相机的部分会被透视放大，朴素算法算出的距离偏小、模型照样出画。
     */
    const fitCamera = () => {
      const camera = getCamera();
      const container = containerRef.current;
      const rho = radiusRef.current;
      const halfHeight = halfHeightRef.current;
      if (!camera || !container || !rho) return;
      const aspect = container.clientWidth / container.clientHeight;
      if (!aspect) return;

      const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const k = FILL_RATIO * vTan * aspect;
      const distance = Math.max(
        rho * Math.sqrt(1 + 1 / (k * k)),
        halfHeight / (FILL_RATIO * vTan),
      );
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
    };

    const loader = new GLTFLoader();
    // 模型经 meshopt 压缩（EXT_meshopt_compression），需注册解码器
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(MODEL_URL, (gltf) => {
      if (!active) {
        disposeObject3D(gltf.scene);
        return;
      }
      gltf.scene.scale.set(4, 4, 4);
      scene.add(gltf.scene);

      // 量一次尺寸：ρ 取包围盒在 xz 平面上的对角（旋转不变的水平上界），
      // 垂直半高取包围盒上下限的较大者（模型不一定关于原点对称）
      const box = new THREE.Box3().setFromObject(gltf.scene);
      radiusRef.current = Math.hypot(
        Math.max(Math.abs(box.min.x), box.max.x),
        Math.max(Math.abs(box.min.z), box.max.z),
      );
      halfHeightRef.current = Math.max(Math.abs(box.min.y), box.max.y);

      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        mixerRef.current = mixer;
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
      }
      fitCamera();
      // 首帧就绪 → 触发占位层淡出（见下方 render）
      setLoaded(true);
    });

    // 画布尺寸变化（窗口缩放 / 窄屏换行导致右列变矮）后重新适配相机
    const resizeObserver = new ResizeObserver(fitCamera);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      active = false;
      resizeObserver.disconnect();
      radiusRef.current = 0;
      halfHeightRef.current = 0;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getScene/getCamera 是引擎暴露的稳定访问器（内部读 ref），只在挂载时取一次
  }, []);

  return (
    // h-full：跟随右列高度（父级 flex item 有确定高度）
    // min-h-75：窄屏下右列换行时父级高度不再确定，h-full 会算成 0
    //           —— 用最小高度兜底，避免画布被压成 0
    // relative：占位层需要绝对定位盖在画布之上
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-75 min-w-75"
    >
      {/*
        canvas 用 absolute，不是为了省事，是为了消除 0.56px 抖动：

        普通流内时，canvas 是**替换元素**，会把内建宽高比（缓冲区 689×440）带进布局
        —— 容器 h-full 在「内容撑高 ↔ 高度决定内容」之间循环，浏览器退回按内容算，
        于是容器（进而是 hero）被撑到 440.56；而占位层没有内建比例、高度正好 440。
        两者差 0.56px ⇒ 切换瞬间下方内容会微移。

        改成 absolute 后画布脱离文档流，容器高度只由 flex 决定（h-full → 440），
        实测占位态与终态都是 440.00。

        ★ w-full h-full 不能省：绝对定位的替换元素在 width:auto 时会退回**内建宽度**
          （689，比容器 689.89 窄 0.89px 且不居中）。显式给百分比才会精确铺满。
      */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full"
      />

      {/*
        模型就绪前的占位层：盖在画布之上（DOM 顺序在后 + absolute）。
        就绪后先淡出、过渡结束再卸载 —— 避免「占位消失」与「模型出现」之间闪底色。
        loaded 后补 pointer-events-none：淡出过程中不该继续拦住 OrbitControls 的拖拽。
      */}
      {!placeholderGone && (
        <div
          className={`absolute inset-0 transition-opacity duration-500 ease-out ${
            loaded ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          onTransitionEnd={() => {
            if (loaded) setPlaceholderGone(true);
          }}
        >
          <HologramFallback />
        </div>
      )}
    </div>
  );
}
