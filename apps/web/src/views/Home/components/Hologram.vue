<template>
  <div ref="container" class="w-full min-w-75">
    <canvas ref="hologram" class="block w-full h-auto" />
  </div>
</template>
<script setup lang="ts">
import { useTemplateRef } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useThreeScene } from "@/hooks/useThreeScene";

const hologram = useTemplateRef<HTMLCanvasElement>("hologram");
const container = useTemplateRef<HTMLDivElement>("container");

let mixer: THREE.AnimationMixer | null = null;

useThreeScene(container, hologram, {
  autoRotate: 0.002,
  onAnimate: (delta) => {
    mixer?.update(delta);
  },
  onReady: (scene) => {
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const loader = new GLTFLoader();
    loader.load("/models/hologram/scene.gltf", (gltf) => {
      gltf.scene.scale.set(4, 4, 4);
      scene.add(gltf.scene);
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip) => {
          mixer!.clipAction(clip).play();
        });
      }
    });
  },
});
</script>
