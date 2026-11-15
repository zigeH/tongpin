// @vitest-environment node
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { compressGlb } from "../convex/glbCompress";

const modules = import.meta.glob("../convex/**/*.*s");
const MODEL_URL = "https://meshy.example/model.glb";
const BROKEN_GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);

let served: Uint8Array<ArrayBuffer>;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      return url === MODEL_URL ? new Response(served) : new Response("nope", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function texturedGlb(size: number): Promise<Uint8Array<ArrayBuffer>> {
  const noise = Buffer.alloc(size * size * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = ((i / 3) % size) / 16 + Math.random() * 32;
  const png = await sharp(noise, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
  const document = new Document();
  const buffer = document.createBuffer();
  const position = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(buffer);
  const uv = document
    .createAccessor()
    .setType("VEC2")
    .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
    .setBuffer(buffer);
  const texture = document.createTexture().setImage(new Uint8Array(png)).setMimeType("image/png");
  const material = document.createMaterial().setBaseColorTexture(texture);
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setAttribute("TEXCOORD_0", uv)
    .setMaterial(material);
  const mesh = document.createMesh().addPrimitive(primitive);
  document.createScene().addChild(document.createNode().setMesh(mesh));
  return new Uint8Array(await new NodeIO().writeBinary(document));
}

async function readStored(t: ReturnType<typeof convexTest>, boxId: string) {
  const { box, buffer, fileCount } = await t.run(async (ctx) => {
    const box = await ctx.db.get(boxId as never);
    const blob = await ctx.storage.get((box as { modelId: never }).modelId);
    const files = await ctx.db.system.query("_storage").collect();
    return { box, buffer: await blob!.arrayBuffer(), fileCount: files.length };
  });
  return { box, bytes: new Uint8Array(buffer), fileCount };
}

async function seedBox(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const png = () => ctx.storage.store(new Blob(["x"], { type: "image/png" }));
    return ctx.db.insert("boxes", {
      code: "000001",
      senderId: userId,
      status: "preparing",
      photoId: await png(),
      cutoutId: await png(),
    });
  });
}

test("compressGlb 把贴图缩到 1024 并转成 WebP", async () => {
  const input = await texturedGlb(2048);
  const output = await compressGlb(input);
  expect(new TextDecoder().decode(output.subarray(0, 4))).toBe("glTF");
  expect(output.byteLength).toBeLessThan(input.byteLength);
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(output);
  const [texture] = document.getRoot().listTextures();
  expect(texture.getMimeType()).toBe("image/webp");
  expect(texture.getSize()).toEqual([1024, 1024]);
});

test("kara.download 存的是压缩后的 GLB，并删掉原文件", async () => {
  const t = convexTest(schema, modules);
  const boxId = await seedBox(t);
  served = await texturedGlb(2048);
  await t.action(internal.kara.download, { boxId, kind: "original", url: MODEL_URL });
  const { box, bytes, fileCount } = await readStored(t, boxId);
  expect(box).toMatchObject({ status: "ready" });
  expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("glTF");
  expect(bytes.byteLength).toBeLessThan(served.byteLength);
  expect(fileCount).toBe(3);
});

test("压缩失败时 kara.download 退回原文件，流程照常推进", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const t = convexTest(schema, modules);
  const boxId = await seedBox(t);
  served = BROKEN_GLB;
  await t.action(internal.kara.download, { boxId, kind: "original", url: MODEL_URL });
  const { box, bytes, fileCount } = await readStored(t, boxId);
  expect(box).toMatchObject({ status: "ready" });
  expect(bytes).toEqual(BROKEN_GLB);
  expect(fileCount).toBe(3);
  expect(errorSpy).toHaveBeenCalledWith("GLB 压缩失败，保存原文件", expect.anything());
});
