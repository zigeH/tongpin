import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { assertStatus } from "../../lib/status";
import { newUniqueCode } from "../../lib/code";

export const reply = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users"), senderNote: v.optional(v.string()) },
  handler: async (ctx, { boxId, userId, senderNote }) => {
    const old = await ctx.db.get(boxId);
    if (old === null) fail("BOX_NOT_FOUND");
    if (old.senderId !== userId) fail("NOT_SENDER");
    assertStatus(old, "opened");
    if (old.editedImageId === undefined || old.editedModelId === undefined) {
      fail("WRONG_STATUS", "旧盒子缺少改造结果，不能回礼");
    }
    const newBoxId = await ctx.db.insert("boxes", {
      code: await newUniqueCode(ctx),
      senderId: userId,
      receiverId: old.receiverId,
      status: "ready",
      replyTo: old._id,
      senderNote,
      photoId: old.editedImageId,
      cutoutId: old.editedImageId,
      modelId: old.editedModelId,
    });
    return { boxId: newBoxId };
  },
});
