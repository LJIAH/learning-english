import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useThreeScene } from "@/hooks/useThreeScene";

/** 优化后的模型：4.84MB → 0.49MB（9.8x）。生成方式见 scripts/optimize-models.mjs */
const MODEL_URL = "/models/hologram/scene.opt.glb";

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

  const { getScene } = useThreeScene(containerRef, canvasRef, {
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
      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        mixerRef.current = mixer;
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
      }
    });

    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getScene 是引擎暴露的稳定访问器
  }, []);

  return (
    <div ref={containerRef} className="w-full min-w-75">
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
}
