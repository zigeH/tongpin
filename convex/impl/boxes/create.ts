import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { newUniqueCode } from "../../lib/code";
import { fail } from "../../lib/errors";

const PHOTO_TYPES = ["image/jpeg", "image/png"];

export const create = mutation({
  args: {
    userId: v.id("users"),
    photoStorageId: v.id("_storage"),
    senderNote: v.optional(v.string()),
  },
  handler: async (ctx, { userId, photoStorageId, senderNote }) => {
    if ((await ctx.db.get(userId)) === null) fail("USER_NOT_FOUND");
    const photo = await ctx.db.system.get(photoStorageId);
    if (photo === null) fail("INVALID_INPUT", "照片文件不存在");
    if (!PHOTO_TYPES.includes(photo.contentType ?? "")) {
      fail("INVALID_INPUT", `照片只接受 JPEG 或 PNG，收到 ${photo.contentType ?? "未知类型"}`);
    }
    const boxId = await ctx.db.insert("boxes", {
      code: await newUniqueCode(ctx),
      senderId: userId,
      status: "preparing",
      senderNote,
      photoId: photoStorageId,
    });
    await ctx.scheduler.runAfter(0, internal.prepare.run, { boxId });
    return { boxId };
  },
});
