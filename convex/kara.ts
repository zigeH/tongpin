import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { fail } from "./lib/errors";
import { isMock3D, SAMPLE_GLB_URL } from "./lib/mock";
import { assertStatus, modelKind, type ModelKind } from "./lib/status";

const FAKE_DELAY_MS = 3000;

export function assertAttachable(box: Doc<"boxes">, kind: ModelKind) {
  if (kind === "original") {
    assertStatus(box, "preparing");
    if (box.cutoutId === undefined) fail("WRONG_STATUS", "还没有抠图，不能接收原版 3D");
  } else {
    assertStatus(box, "editing");
    if (box.editedImageId === undefined) fail("WRONG_STATUS", "还没有改图结果，不能接收改后 3D");
  }
}

export async function attachToBox(
  ctx: MutationCtx,
  boxId: Id<"boxes">,
  kind: ModelKind,
  modelStorageId: Id<"_storage">,
) {
  const box = await ctx.db.get(boxId);
  if (box === null) fail("BOX_NOT_FOUND");
  assertAttachable(box, kind);
  if (kind === "original") {
    await ctx.db.patch(boxId, { modelId: modelStorageId, status: "ready", editError: undefined });
  } else {
    await ctx.db.patch(boxId, { editedModelId: modelStorageId, status: "edited" });
  }
}

export const attach = internalMutation({
  args: { boxId: v.id("boxes"), kind: modelKind, modelStorageId: v.id("_storage") },
  handler: async (ctx, { boxId, kind, modelStorageId }) => {
    await attachToBox(ctx, boxId, kind, modelStorageId);
    return null;
  },
});

export const download = internalAction({
  args: { boxId: v.id("boxes"), kind: modelKind, url: v.string() },
  handler: async (ctx, { boxId, kind, url }) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载 3D 失败：HTTP ${res.status} ${url}`);
    const blob = new Blob([await res.arrayBuffer()], { type: "model/gltf-binary" });
    const originalId = await ctx.storage.store(blob);
    let modelStorageId = originalId;
    try {
      modelStorageId = await ctx.runAction(internal.glbCompress.compress, { storageId: originalId });
    } catch (e) {
      console.error("GLB 压缩失败，保存原文件", e);
    }
    if (modelStorageId !== originalId) await ctx.storage.delete(originalId);
    try {
      await ctx.runMutation(internal.kara.attach, { boxId, kind, modelStorageId });
    } catch (e) {
      await ctx.storage.delete(modelStorageId);
      throw e;
    }
    return null;
  },
});

export const fake = internalAction({
  args: { boxId: v.id("boxes"), kind: modelKind },
  handler: async (ctx, { boxId, kind }) => {
    await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS));
    await ctx.runAction(internal.kara.download, { boxId, kind, url: SAMPLE_GLB_URL });
    return null;
  },
});

export const imageUrlFor = internalQuery({
  args: { boxId: v.id("boxes"), kind: modelKind },
  handler: async (ctx, { boxId, kind }) => {
    const box = await ctx.db.get(boxId);
    const imageId = kind === "original" ? box?.cutoutId : box?.editedImageId;
    return imageId === undefined ? null : await ctx.storage.getUrl(imageId);
  },
});

export const request = internalAction({
  args: { boxId: v.id("boxes"), kind: modelKind },
  handler: async (ctx, { boxId, kind }) => {
    if (isMock3D()) {
      await ctx.scheduler.runAfter(0, internal.kara.fake, { boxId, kind });
      return null;
    }
    if (process.env.MESHY_API_KEY) {
      await ctx.scheduler.runAfter(0, internal.meshy.start, { boxId, kind });
      return null;
    }
    const webhook = process.env.KARA_WEBHOOK_URL;
    if (!webhook) return null;
    const imageUrl = await ctx.runQuery(internal.kara.imageUrlFor, { boxId, kind });
    if (imageUrl === null) throw new Error(`盒子 ${boxId} 没有 ${kind} 的图片，不通知 Kara`);
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boxId, kind, imageUrl }),
    });
    if (!res.ok) console.error(`通知 Kara 失败：HTTP ${res.status}，她仍可通过 kara.pending 拉取`);
    return null;
  },
});

export const pending = query({
  args: {},
  handler: async (ctx): Promise<{ boxId: Id<"boxes">; kind: ModelKind; imageUrl: string }[]> => {
    const boxes = await ctx.db
      .query("boxes")
      .filter((q) => q.or(q.eq(q.field("status"), "preparing"), q.eq(q.field("status"), "editing")))
      .collect();
    const result: { boxId: Id<"boxes">; kind: ModelKind; imageUrl: string }[] = [];
    for (const box of boxes) {
      const job: [ModelKind, Id<"_storage">] | null =
        box.status === "preparing" && box.cutoutId !== undefined && box.modelId === undefined
          ? ["original", box.cutoutId]
          : box.status === "editing" && box.editedImageId !== undefined && box.editedModelId === undefined
            ? ["edited", box.editedImageId]
            : null;
      if (job === null) continue;
      const imageUrl = await ctx.storage.getUrl(job[1]);
      if (imageUrl !== null) result.push({ boxId: box._id, kind: job[0], imageUrl });
    }
    return result;
  },
});
