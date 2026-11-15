import { mutation, type MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { cameraPose } from "../../schema";
import { fail } from "../../lib/errors";
import { assertStatus } from "../../lib/status";

async function assertImageType(ctx: MutationCtx, storageId: Id<"_storage">, allowed: string[], label: string) {
  const file = await ctx.db.system.get(storageId);
  if (file === null) fail("INVALID_INPUT", `${label} 文件不存在`);
  if (!allowed.includes(file.contentType ?? "")) {
    fail("INVALID_INPUT", `${label} 只接受 ${allowed.join(" / ")}，收到 ${file.contentType ?? "未知类型"}`);
  }
}

const isVec3 = (xs: number[]) => xs.length === 3 && xs.every(Number.isFinite);

export const submitEdit = mutation({
  args: {
    boxId: v.id("boxes"),
    userId: v.id("users"),
    snapshotStorageId: v.id("_storage"),
    sceneShotStorageId: v.optional(v.id("_storage")),
    cameraPose,
    prompt: v.string(),
    extraPhotoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const box = await ctx.db.get(args.boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    if (box.receiverId !== args.userId) fail("NOT_RECEIVER");
    assertStatus(box, "claimed", "edited");

    const prompt = args.prompt.trim();
    const length = [...prompt].length;
    if (length < 1 || length > 200) fail("INVALID_INPUT", "prompt 需要 1–200 字");
    if (!isVec3(args.cameraPose.position) || !isVec3(args.cameraPose.target) || !Number.isFinite(args.cameraPose.fov)) {
      fail("INVALID_INPUT", "cameraPose 的 position、target 必须是 3 个数字");
    }

    await assertImageType(ctx, args.snapshotStorageId, ["image/png"], "定格图");
    if (args.sceneShotStorageId) await assertImageType(ctx, args.sceneShotStorageId, ["image/jpeg", "image/png"], "合拍照");
    if (args.extraPhotoStorageId) await assertImageType(ctx, args.extraPhotoStorageId, ["image/jpeg", "image/png"], "照片");

    await ctx.db.patch(args.boxId, {
      status: "editing",
      snapshotId: args.snapshotStorageId,
      sceneShotId: args.sceneShotStorageId,
      cameraPose: args.cameraPose,
      prompt,
      extraPhotoId: args.extraPhotoStorageId,
      editedImageId: undefined,
      editedModelId: undefined,
      editError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.edit.run, { boxId: args.boxId });
    return null;
  },
});
