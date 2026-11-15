import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { newUniqueCode } from "./lib/code";
import { fakeCutoutBlob, SAMPLE_GLB_URL } from "./lib/mock";

export const DEMO_A = "演示A";
export const DEMO_B = "演示B";

const assets = {
  photoId: v.id("_storage"),
  cutoutId: v.id("_storage"),
  modelId: v.id("_storage"),
  snapshotId: v.id("_storage"),
  sceneShotId: v.id("_storage"),
  extraPhotoId: v.id("_storage"),
  editedImageId: v.id("_storage"),
  editedModelId: v.id("_storage"),
};

type SeedResult = {
  userAId: Id<"users">;
  userBId: Id<"users">;
  readyBox: { boxId: Id<"boxes">; code: string };
  sealedBox: { boxId: Id<"boxes">; code: string };
};

export const demo = action({
  args: {
    photoId: v.optional(v.id("_storage")),
    cutoutId: v.optional(v.id("_storage")),
    modelId: v.optional(v.id("_storage")),
    snapshotId: v.optional(v.id("_storage")),
    sceneShotId: v.optional(v.id("_storage")),
    extraPhotoId: v.optional(v.id("_storage")),
    editedImageId: v.optional(v.id("_storage")),
    editedModelId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<SeedResult> => {
    const needsImage = !args.photoId || !args.cutoutId || !args.snapshotId || !args.sceneShotId
      || !args.extraPhotoId || !args.editedImageId;
    const needsModel = !args.modelId || !args.editedModelId;

    const fakeImageId = needsImage ? await ctx.storage.store(fakeCutoutBlob()) : undefined;
    let sampleModelId: Id<"_storage"> | undefined;
    if (needsModel) {
      const res = await fetch(SAMPLE_GLB_URL);
      if (!res.ok) throw new Error(`下载示例 GLB 失败：HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      sampleModelId = await ctx.storage.store(new Blob([bytes], { type: "model/gltf-binary" }));
    }

    const image = (id?: Id<"_storage">) => (id ?? fakeImageId)!;
    const model = (id?: Id<"_storage">) => (id ?? sampleModelId)!;
    return await ctx.runMutation(internal.seed.write, {
      photoId: image(args.photoId),
      cutoutId: image(args.cutoutId),
      modelId: model(args.modelId),
      snapshotId: image(args.snapshotId),
      sceneShotId: image(args.sceneShotId),
      extraPhotoId: image(args.extraPhotoId),
      editedImageId: image(args.editedImageId),
      editedModelId: model(args.editedModelId),
    });
  },
});

export const write = internalMutation({
  args: assets,
  handler: async (ctx, files): Promise<SeedResult> => {
    const keep = new Set<string>(Object.values(files));
    const staleFiles = new Set<Id<"_storage">>();
    const users = await ctx.db.query("users").collect();
    for (const user of users.filter((u) => u.nickname === DEMO_A || u.nickname === DEMO_B)) {
      const boxes = [
        ...(await ctx.db.query("boxes").withIndex("by_sender", (q) => q.eq("senderId", user._id)).collect()),
        ...(await ctx.db.query("boxes").withIndex("by_receiver", (q) => q.eq("receiverId", user._id)).collect()),
      ];
      for (const box of boxes) {
        if ((await ctx.db.get(box._id)) === null) continue;
        for (const id of [
          box.photoId, box.cutoutId, box.modelId, box.snapshotId, box.sceneShotId,
          box.extraPhotoId, box.editedImageId, box.editedModelId,
        ]) {
          if (id !== undefined) staleFiles.add(id);
        }
        for (const exp of await ctx.db.query("exports").withIndex("by_box", (q) => q.eq("boxId", box._id)).collect()) {
          staleFiles.add(exp.videoId);
          await ctx.db.delete(exp._id);
        }
        await ctx.db.delete(box._id);
      }
      await ctx.db.delete(user._id);
    }
    for (const id of staleFiles) {
      if (!keep.has(id) && (await ctx.db.system.get(id)) !== null) await ctx.storage.delete(id);
    }

    const now = Date.now();
    const userAId = await ctx.db.insert("users", { nickname: DEMO_A, color: "#FF8C00", createdAt: now });
    const userBId = await ctx.db.insert("users", { nickname: DEMO_B, color: "#1E90FF", createdAt: now });

    const readyCode = await newUniqueCode(ctx);
    const readyBoxId = await ctx.db.insert("boxes", {
      code: readyCode,
      senderId: userAId,
      receiverId: userBId,
      status: "ready",
      senderNote: "送你一只小鸭子，改造它吧",
      photoId: files.photoId,
      cutoutId: files.cutoutId,
      modelId: files.modelId,
    });

    const sealedCode = await newUniqueCode(ctx);
    const sealedBoxId = await ctx.db.insert("boxes", {
      code: sealedCode,
      senderId: userAId,
      receiverId: userBId,
      status: "sealed",
      senderNote: "这只鸭子交给你了",
      ...files,
      cameraPose: { position: [0, 1.2, 3], target: [0, 0.5, 0], fov: 45 },
      prompt: "给它戴一顶草帽",
      receiverNote: "改好了，开吧",
      sealedAt: now,
    });

    return {
      userAId,
      userBId,
      readyBox: { boxId: readyBoxId, code: readyCode },
      sealedBox: { boxId: sealedBoxId, code: sealedCode },
    };
  },
});
