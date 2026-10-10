/**
 * 3D 模型优化脚本（glTF → 更小的 glb）
 *
 * 用法：pnpm --filter @en/web-react models:optimize
 *
 * 本模型（Primary Ion Drive，Sketchfab CC-BY-4.0）的构成特征决定了优化手段：
 *   - 零贴图（images/textures/samplers 均为 0）→ 4.8MB 全是几何体
 *   - 颜色来自顶点色 COLOR_0（红/蓝/黄），不是材质贴图 → COLOR_0 必须保留
 *   - TEXCOORD_0 无任何纹理可采样 → 纯废数据，直接删除
 *   - 无 extensionsUsed → 无自定义着色器依赖 UV
 *
 * 管线：删 UV → dedup → weld → prune → resample → quantize → (可选 meshopt)
 * 产出两个文件：
 *   scene.q.glb    仅量化（KHR_mesh_quantization），three 的 GLTFLoader 原生支持，
 *                  无需任何额外解码器 —— 零运行时成本
 *   scene.opt.glb  量化 + meshopt（EXT_meshopt_compression），体积更小，
 *                  运行时需 MeshoptDecoder（three 已内置，约 30KB，随包一起）
 */
import { NodeIO } from "@gltf-transform/core";
import {
  KHRONOS_EXTENSIONS,
  EXTMeshoptCompression,
} from "@gltf-transform/extensions";
import {
  dedup,
  weld,
  prune,
  resample,
  quantize,
  meshopt,
} from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const modelDir = join(here, "../public/models/hologram");
const input = join(modelDir, "scene.gltf");

const kb = (bytes) => (bytes / 1024).toFixed(0) + " KB";
const mb = (bytes) => (bytes / 1048576).toFixed(2) + " MB";
const sizeOf = (p) => {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
};

/** 模型原始体积 = gltf + 外部 bin */
const originalSize = sizeOf(input) + sizeOf(join(modelDir, "scene.bin"));

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

await MeshoptEncoder.ready;

/** 跑完整优化管线；withMeshopt 决定最后是否做 meshopt 压缩 */
async function build(withMeshopt) {
  const doc = await io.read(input);

  // 1) 删除无用的 TEXCOORD_0（零贴图，UV 无处可采样）
  let droppedUV = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute("TEXCOORD_0")) {
        prim.setAttribute("TEXCOORD_0", null);
        droppedUV++;
      }
    }
  }

  // 2) 基础清理 + 动画重采样（4 条通道的关键帧去冗余）
  await doc.transform(dedup(), weld(), prune(), resample());

  // 3) 量化：POSITION int16 / NORMAL int8 / COLOR_0 uint8
  //    顶点色是颜色来源，量化到 8 位（等同 PNG 精度），肉眼无差
  await doc.transform(quantize());

  // 4) 可选：meshopt 压缩
  if (withMeshopt) {
    await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  }

  const outName = withMeshopt ? "scene.opt.glb" : "scene.q.glb";
  const outPath = join(modelDir, outName);

  const outIO = new NodeIO()
    .registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression])
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  await outIO.write(outPath, doc);

  return { outName, outPath, droppedUV };
}

const q = await build(false);
const opt = await build(true);

console.log("原始体积（gltf+bin）:", mb(originalSize));
console.log(
  `${q.outName}  仅量化:        ${mb(sizeOf(q.outPath))}  (${kb(sizeOf(q.outPath))})`,
);
console.log(
  `${opt.outName} 量化+meshopt:  ${mb(sizeOf(opt.outPath))}  (${kb(sizeOf(opt.outPath))})`,
);
console.log(
  `压缩比: 仅量化 ${(originalSize / sizeOf(q.outPath)).toFixed(1)}x | meshopt ${(originalSize / sizeOf(opt.outPath)).toFixed(1)}x`,
);
console.log("删除的 TEXCOORD_0 数量:", q.droppedUV);

// 打印 glb 里实际使用的扩展，确认运行时需要什么
const buf = readFileSync(opt.outPath);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
console.log(
  "opt.glb extensionsUsed:",
  JSON.stringify(gltf.extensionsUsed || []),
);
