"use node";
import { v } from "convex/values";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, textureCompress } from "@gltf-transform/functions";
import sharp from "sharp";
import { internalAction } from "./_generated/server";

const MAX_TEXTURE_SIZE = 1024;

export async function compressGlb(input: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(input);
  await document.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE] }),
  );
  return new Uint8Array(await io.writeBinary(document));
}

export const compress = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const blob = await ctx.storage.get(storageId);
    if (blob === null) throw new Error(`GLB 不存在：${storageId}`);
    const input = new Uint8Array(await blob.arrayBuffer());
    const output = await compressGlb(input);
    console.log(`GLB 压缩：${input.byteLength} → ${output.byteLength} 字节`);
    if (output.byteLength >= input.byteLength) return storageId;
    return await ctx.storage.store(new Blob([output], { type: "model/gltf-binary" }));
  },
});
