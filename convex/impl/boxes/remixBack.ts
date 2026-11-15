import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { assertStatus } from "../../lib/status";
import { newUniqueCode } from "../../lib/code";

export const remixBack = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users") },
  handler: async (ctx, { boxId, userId }) => {
    const old = await ctx.db.get(boxId);
    if (old === null) fail("BOX_NOT_FOUND");
    if (old.senderId !== userId) fail("NOT_SENDER");
    assertStatus(old, "opened");
    if (old.receiverId === undefined || old.editedImageId === undefined || old.editedModelId === undefined) {
      fail("WRONG_STATUS", "旧盒子缺少改造结果，不能接力");
    }
    const existing = await ctx.db
      .query("boxes")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .filter((q) => q.eq(q.field("replyTo"), boxId))
      .first();
    if (existing !== null) return { boxId: existing._id };

    const newBoxId = await ctx.db.insert("boxes", {
      code: await newUniqueCode(ctx),
      senderId: old.receiverId,
      receiverId: userId,
      status: "claimed",
      replyTo: boxId,
      photoId: old.editedImageId,
      cutoutId: old.editedImageId,
      modelId: old.editedModelId,
    });
    return { boxId: newBoxId };
  },
});
