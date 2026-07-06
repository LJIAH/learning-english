**[useThreeScene.ts](file:///g:/test/Nest/english/apps/web/src/hooks/useThreeScene.ts)** — Three.js 场景引擎 Composable

- **职责**：场景 / 相机 / 渲染器 / 轨道控制器 / ResizeObserver / 动画循环 / 销毁清理
- **不负责**：模型加载、灯光等业务逻辑，通过 `onReady` 回调由调用方自行处理
- **注意**：`renderer.setSize()` 第三个参数固定为 `false`，仅更新绘图缓冲区，不修改 CSS 宽高，避免锁定响应式尺寸

**配置项：**

| 参数             | 类型                                | 默认值  | 说明                                                     |
| ---------------- | ----------------------------------- | ------- | -------------------------------------------------------- |
| `aspectRatio`    | `number`                            | `2`     | 宽高比（width / aspectRatio 作为高度）                   |
| `enableControls` | `boolean`                           | `true`  | 是否启用 OrbitControls 轨道控制器                        |
| `autoRotate`     | `boolean \| number`                 | `false` | 自动旋转，`true` 使用默认速度 0.002，`number` 自定义速度 |
| `cameraZ`        | `number`                            | `10`    | 相机初始 Z 轴位置                                        |
| `onAnimate`      | `(delta: number) => void`           | —       | 每帧动画回调，可用于更新 AnimationMixer                  |
| `onReady`        | `(scene, camera, renderer) => void` | —       | 场景就绪回调，用于添加灯光、加载模型等                   |

**返回值：** `{ getScene, getCamera, getRenderer }`

**基础用法（单模型 + 自动旋转）：**

```ts
<template>
  <div ref="containerRef" class="w-full min-w-75">
    <canvas ref="canvasRef" class="block w-full h-auto" />
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useThreeScene } from "@/hooks/useThreeScene";

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvasRef");
const containerRef = useTemplateRef<HTMLDivElement>("containerRef");

let mixer: THREE.AnimationMixer | null = null;

useThreeScene(containerRef, canvasRef, {
  autoRotate: 0.002,
  onAnimate: (delta) => {
    mixer?.update(delta);
  },
  onReady: (scene) => {
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    const loader = new GLTFLoader();
    loader.load("/models/hologram/scene.gltf", (gltf) => {
      gltf.scene.scale.set(4, 4, 4);
      scene.add(gltf.scene);
      if (gltf.animations?.length > 0) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
      }
    });
  },
});
</script>
```

**模型切换用法（同一 Canvas 内切换模型）：**

```ts
<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useThreeScene } from "@/hooks/useThreeScene";

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvasRef");
const containerRef = useTemplateRef<HTMLDivElement>("containerRef");

const MODEL_MAP = {
  login: { url: "/models/login/scene.gltf", scale: 4 },
  register: { url: "/models/register/scene.gltf", scale: 4 },
} as const;

let sceneRef: THREE.Scene | null = null;
let currentModel: THREE.Group | null = null;
let mixer: THREE.AnimationMixer | null = null;
const loader = new GLTFLoader();

const removeModel = () => {
  if (currentModel && sceneRef) {
    sceneRef.remove(currentModel);
    currentModel.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    currentModel = null;
  }
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }
};

const loadModel = (key: "login" | "register") => {
  if (!sceneRef) return;
  removeModel();
  const config = MODEL_MAP[key];
  loader.load(config.url, (gltf) => {
    if (!sceneRef) return;
    currentModel = gltf.scene;
    currentModel.scale.set(config.scale, config.scale, config.scale);
    sceneRef.add(currentModel);
    if (gltf.animations?.length > 0) {
      mixer = new THREE.AnimationMixer(currentModel);
      gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
    }
  });
};

const switchModel = (key: "login" | "register") => loadModel(key);

useThreeScene(containerRef, canvasRef, {
  enableControls: false,
  onAnimate: (delta) => {
    mixer?.update(delta);
  },
  onReady: (scene) => {
    sceneRef = scene;
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);
    loadModel("login");
  },
});
</script>
```
