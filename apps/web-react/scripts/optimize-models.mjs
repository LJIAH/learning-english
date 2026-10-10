/**
 * 3D 模型优化管线（源文件 → public 下的优化产物）
 *
 * 用法：pnpm --filter @en/web-react models:optimize
 *
 * 目录约定（新增模型只需把源文件丢进 models-src/<name>/ 再跑一次本脚本）：
 *   models-src/<name>/            原始模型（.gltf+.bin 或 .glb，可含贴图、license.txt）
 *                                 —— 不入库（体积大）
 *   public/models/<name>/scene.opt.glb
 *                                 优化产物 —— 入库（部署产物需要它，否则线上没模型）
 *   public/models/<name>/license.txt
 *                                 源目录若带 license.txt 则一并拷贝（CC-BY 等署名义务）
 *
 * 管线：删无用 UV → dedup → weld → prune → resample → quantize → meshopt
 * 说明：
 *   - 仅当模型**无贴图**时才删 TEXCOORD_0（有贴图时 UV 是必需的）
 *   - 顶点色 COLOR_0 保留（可能是颜色来源，如本仓库 hologram），量化到 uint8
 *   - 产物是自包含单文件 .glb，运行时需 three 内置 MeshoptDecoder
 *
 * 本仓库 hologram 模型实测：4.84MB → 0.49MB（9.8x），几何零损失。
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
import {
  readdirSync,
  statSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "../models-src");
const outRoot = join(here, "../public/models");

const mb = (b) => (b / 1048576).toFixed(2) + " MB";
const sizeOf = (p) => {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
};

/** 源目录里找模型入口：优先 .gltf，其次 .glb */
function findSource(dir) {
  const files = readdirSync(dir);
  const gltf = files.find((f) => f.endsWith(".gltf"));
  if (gltf) {
    const bin = files.find((f) => f.endsWith(".bin"));
    return {
      file: join(dir, gltf),
      originalSize:
        sizeOf(join(dir, gltf)) + (bin ? sizeOf(join(dir, bin)) : 0),
    };
  }
  const glb = files.find((f) => f.endsWith(".glb"));
  if (glb)
    return { file: join(dir, glb), originalSize: sizeOf(join(dir, glb)) };
  return null;
}

await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const outIO = new NodeIO()
  .registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

async function optimizeOne(name) {
  const srcDir = join(srcRoot, name);
  const src = findSource(srcDir);
  if (!src) {
    console.log(`- ${name}: 跳过（未找到 .gltf/.glb）`);
    return;
  }

  const doc = await io.read(src.file);
  const root = doc.getRoot();

  // 1) 仅当无贴图时才删 TEXCOORD_0（有贴图时 UV 必需）
  const hasTextures = root.listTextures().length > 0;
  if (!hasTextures) {
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getAttribute("TEXCOORD_0"))
          prim.setAttribute("TEXCOORD_0", null);
      }
    }
  }

  // 2) 清理 + 动画重采样 + 量化 + meshopt
  await doc.transform(dedup(), weld(), prune(), resample(), quantize());
  await doc.transform(meshopt({ encoder: MeshoptEncoder }));

  const outDir = join(outRoot, name);
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "scene.opt.glb");
  await outIO.write(outFile, doc);

  // 3) 署名文件一并拷出（CC-BY 等义务）
  const license = join(srcDir, "license.txt");
  if (existsSync(license)) copyFileSync(license, join(outDir, "license.txt"));

  console.log(
    `- ${name}: ${mb(src.originalSize)} → ${mb(sizeOf(outFile))} ` +
      `(${(src.originalSize / sizeOf(outFile)).toFixed(1)}x, ` +
      `${hasTextures ? "含贴图" : "无贴图/已删UV"})`,
  );
}

const names = readdirSync(srcRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

if (names.length === 0) {
  console.log(`models-src 为空，无可优化模型（源目录: ${srcRoot}）`);
} else {
  console.log(`发现 ${names.length} 个模型源目录，开始优化：`);
  for (const name of names) await optimizeOne(name);
}
