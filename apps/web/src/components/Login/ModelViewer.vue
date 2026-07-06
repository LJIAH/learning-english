<template>
  <div class="relative w-135 shrink-0 h-full bg-linear-to-br from-gray-800 to-gray-900">
    <div ref="containerRef" class="w-full h-full">
      <canvas class="block w-full h-full" ref="canvasRef"></canvas>
    </div>
    <!-- 模型加载占位 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-gray-800 to-gray-900"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"
        />
        <span class="text-white/60 text-sm">加载模型中...</span>
      </div>
    </div>
    <div class="absolute top-6 left-6">
      <div class="flex items-center gap-2">
        <div
          class="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-[10px] flex items-center justify-center"
        >
          <span class="text-white font-bold text-xl">E</span>
        </div>
        <span class="text-white text-xl font-bold">English App</span>
      </div>
    </div>
    <!-- 登录/注册切换按钮 -->
    <div class="absolute top-6 right-6">
      <div
        class="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-1"
      >
        <button :class="loginClass" @click="switchModel('login')">登录</button>
        <button :class="registerClass" @click="switchModel('register')">
          注册
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useThreeScene } from "@/hooks/useThreeScene";

const emits = defineEmits(["changeType"]);

const MODEL_MAP = {
  login: { url: "/models/login/scene.gltf", scale: 0.8 },
  register: { url: "/models/register/scene.gltf", scale: 0.8 },
} as const;

export type LoginType = keyof typeof MODEL_MAP;

const type = ref<LoginType>("login");
const loginClass = computed(() =>
  type.value === "login"
    ? "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all"
    : "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
);
const registerClass = computed(() =>
  type.value === "register"
    ? "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all"
    : "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
);

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvasRef");
const containerRef = useTemplateRef<HTMLDivElement>("containerRef");
const models = new Map<LoginType, THREE.Group>();
const mixers = new Map<LoginType, THREE.AnimationMixer>();
const loading = ref(true);
let sceneRef: THREE.Scene | null = null;
const loader = new GLTFLoader();

const addModel = (
  key: LoginType,
  gltf: { scene: THREE.Group; animations?: THREE.AnimationClip[] },
) => {
  if (!sceneRef) return;
  const config = MODEL_MAP[key];
  const model = gltf.scene;
  model.scale.set(config.scale, config.scale, config.scale);
  model.position.y = -0.8;
  model.visible = key === type.value;
  sceneRef.add(model);
  models.set(key, model);

  if (gltf.animations?.length) {
    const mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    mixers.set(key, mixer);
  }
};

const switchModel = (key: LoginType) => {
  emits("changeType", key);
  if (type.value === key) return;
  const old = models.get(type.value);
  const next = models.get(key);
  if (old) old.visible = false;
  if (next) {
    next.visible = true;
    // aimAtModel(next);
  }
  type.value = key;
};

const preloadAll = () => {
  const keys = Object.keys(MODEL_MAP) as LoginType[];
  let loaded = 0;
  keys.forEach((key) => {
    loader.load(MODEL_MAP[key].url, (gltf) => {
      addModel(key, gltf);
      loaded++;
      if (loaded === keys.length) loading.value = false;
    });
  });
};

useThreeScene(containerRef, canvasRef, {
  aspectRatio: "container",
  cameraPosition: { x: 0.1, y: 0.3, z: 1 },
  enableControls: true,
  onAnimate: (delta) => {
    const active = mixers.get(type.value);
    if (active) active.update(delta);
    const model = models.get(type.value);
    if (model) model.rotation.y += 0.002;
  },
  onReady: (scene) => {
    sceneRef = scene;
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);
    preloadAll();
  },
});
</script>
