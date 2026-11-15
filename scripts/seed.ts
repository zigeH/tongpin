import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const ASSETS_DIR = join(import.meta.dirname, "..", "demo-assets");

const ASSETS = {
  photoId: "photo",
  cutoutId: "cutout",
  modelId: "model",
  snapshotId: "snapshot",
  sceneShotId: "scene-shot",
  extraPhotoId: "extra-photo",
  editedImageId: "edited-image",
  editedModelId: "edited-model",
} as const;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
};

if (!process.env.CONVEX_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.CONVEX_URL;
if (!url) {
  console.error("缺少 CONVEX_URL（或项目根目录的 .env.local）");
  process.exit(1);
}
const client = new ConvexHttpClient(url);

async function upload(path: string): Promise<Id<"_storage">> {
  const contentType = CONTENT_TYPES[extname(path).toLowerCase()];
  const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: readFileSync(path),
  });
  if (!res.ok) throw new Error(`上传 ${path} 失败：HTTP ${res.status} ${await res.text()}`);
  return ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
}

const files = existsSync(ASSETS_DIR) ? readdirSync(ASSETS_DIR) : [];
const args: Partial<Record<keyof typeof ASSETS, Id<"_storage">>> = {};
for (const [key, base] of Object.entries(ASSETS) as [keyof typeof ASSETS, string][]) {
  const file = files.find((f) => f.slice(0, -extname(f).length) === base && CONTENT_TYPES[extname(f).toLowerCase()]);
  if (!file) {
    console.log(`- ${key}: demo-assets/ 里没有 ${base}.*，用 MOCK 默认素材`);
    continue;
  }
  args[key] = await upload(join(ASSETS_DIR, file));
  console.log(`- ${key}: 已上传 demo-assets/${file} → ${args[key]}`);
}

const result = await client.action(api.seed.demo, args);
console.log(`
演示A userId: ${result.userAId}
演示B userId: ${result.userBId}
盒子一（ready，B 认领后现场改造）: 码 ${result.readyBox.code}  boxId ${result.readyBox.boxId}
盒子二（sealed，A 直接开盒）:      码 ${result.sealedBox.code}  boxId ${result.sealedBox.boxId}`);
console.log(JSON.stringify(result, null, 2));
