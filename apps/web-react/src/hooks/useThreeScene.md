**`useThreeScene.ts`** — Three.js 场景引擎 Hook（React 版）

- **职责**：场景 / 相机 / 渲染器 / 轨道控制器 / ResizeObserver / 动画循环 / 销毁清理
- **不负责**：模型加载、灯光等业务逻辑，通过 `onReady` 回调由调用方自行处理
- **注意**：`renderer.setSize()` 第三个参数固定为 `false`，仅更新绘图缓冲区，不修改 CSS 宽高，避免锁定响应式尺寸

**配置项：**

| 参数             | 类型                                | 默认值               | 说明                                                                 |
| ---------------- | ----------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `aspectRatio`    | `number \| "container"`             | `2`                  | 宽高比（width / aspectRatio 作为高度），`"container"` 用容器实际高度 |
| `enableControls` | `boolean`                           | `true`               | 是否启用 OrbitControls 轨道控制器                                    |
| `autoRotate`     | `boolean \| number`                 | `false`              | 自动旋转，`true` 使用默认速度 0.002，`number` 自定义速度             |
| `cameraPosition` | `Partial<{x,y,z}>`                  | `{ x:0, y:0, z:10 }` | 相机初始位置                                                         |
| `onAnimate`      | `(delta: number) => void`           | —                    | 每帧动画回调，可用于更新 AnimationMixer                              |
| `onReady`        | `(scene, camera, renderer) => void` | —                    | 场景就绪回调，用于添加灯光、加载模型等                               |

**返回值：** `{ getScene, getCamera, getRenderer }`

**React 移植要点（与 Vue 版的关键差异）：**

1. `options` 含回调，**不能**放进 `useEffect` 依赖数组 —— 否则每次渲染都会销毁并重建 WebGL 上下文。内部用 ref 转发，引擎只在挂载时创建一次。
2. `dispose` 幂等，StrictMode 双挂载（mount→cleanup→mount）安全。
3. 异步模型加载要用 **effect 局部 `active` 标志**守卫（组件级 ref 有竞态窗口）。

**基础用法（单模型 + 自动旋转）：**

```tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useThreeScene } from "@/hooks/useThreeScene";

export default function Hologram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const { getScene } = useThreeScene(containerRef, canvasRef, {
    autoRotate: 0.002,
    onAnimate: (delta) => mixerRef.current?.update(delta),
    onReady: (scene) => {
      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(5, 10, 7.5);
      scene.add(dirLight);
    },
  });

  useEffect(() => {
    const scene = getScene();
    if (!scene) return;
    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder); // 模型经 meshopt 压缩
    loader.load("/models/hologram/scene.opt.glb", (gltf) => {
      if (!active) return;
      gltf.scene.scale.set(4, 4, 4);
      scene.add(gltf.scene);
      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        mixerRef.current = mixer;
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
    });
    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full min-w-75">
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
}
```

**模型切换用法（同一 Canvas 内切换模型，登录/注册 3D 备用）：**

```tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useThreeScene } from "@/hooks/useThreeScene";

const MODEL_MAP = {
  login: { url: "/models/login/scene.opt.glb", scale: 4 },
  register: { url: "/models/register/scene.opt.glb", scale: 4 },
} as const;

type ModelKey = keyof typeof MODEL_MAP;

/** 释放场景树上的几何体与材质 */
const disposeObject3D = (root: THREE.Object3D) => {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
};

export default function AuthModel({ model }: { model: ModelKey }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const { getScene } = useThreeScene(containerRef, canvasRef, {
    enableControls: false,
    onAnimate: (delta) => mixerRef.current?.update(delta),
    onReady: (scene) => {
      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(5, 10, 7.5);
      scene.add(dirLight);
    },
  });

  // model 变化时切换模型：先移除旧的（释放资源），再加载新的
  useEffect(() => {
    const scene = getScene();
    if (!scene) return;
    let active = true;

    const removeCurrent = () => {
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeObject3D(modelRef.current);
        modelRef.current = null;
      }
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };

    removeCurrent();
    const { url, scale } = MODEL_MAP[model];
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(url, (gltf) => {
      if (!active) {
        disposeObject3D(gltf.scene);
        return;
      }
      gltf.scene.scale.set(scale, scale, scale);
      scene.add(gltf.scene);
      modelRef.current = gltf.scene;
      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        mixerRef.current = mixer;
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
    });

    return () => {
      active = false;
      removeCurrent();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getScene 是稳定访问器，切换由 model 驱动
  }, [model]);

  return (
    <div ref={containerRef} className="w-full min-w-75">
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
}
```
