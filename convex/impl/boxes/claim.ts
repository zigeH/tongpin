import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { assertStatus } from "../../lib/status";
import { newUniqueCode } from "../../lib/code";

export const claim = mutation({
  args: { code: v.string(), userId: v.id("users") },
  handler: async (ctx, { code, userId }) => {
    if ((await ctx.db.get(userId)) === null) fail("USER_NOT_FOUND");
    const box = await ctx.db
      .query("boxes")
      .withIndex("by_code", (q) => q.eq("code", code.trim()))
      .first();
    if (box === null) fail("BOX_NOT_FOUND", "盒子码不存在");
    if (box.senderId === userId) fail("INVALID_INPUT", "不能认领自己的盒子");

    if (box.shared) {
      const mine = await ctx.db
        .query("boxes")
        .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
        .filter((q) => q.eq(q.field("sharedFrom"), box._id))
        .first();
      if (mine === null) {
        const boxId = await ctx.db.insert("boxes", {
          code: await newUniqueCode(ctx),
          senderId: box.senderId,
          receiverId: userId,
          status: "claimed",
          sharedFrom: box._id,
          senderNote: box.senderNote,
          photoId: box.photoId,
          cutoutId: box.cutoutId,
          modelId: box.modelId,
        });
        return { boxId };
      }
      if (mine.status === "ready") await ctx.db.patch(mine._id, { status: "claimed" });
      return { boxId: mine._id };
    }

    if (box.receiverId !== undefined && box.receiverId !== userId) fail("ALREADY_CLAIMED");
    if (box.receiverId === userId && box.status !== "ready" && box.status !== "preparing") {
      return { boxId: box._id };
    }
    if (box.status !== "ready") fail("NOT_READY");
    assertStatus(box, "ready");
    await ctx.db.patch(box._id, { receiverId: userId, status: "claimed" });
    return { boxId: box._id };
  },
});
