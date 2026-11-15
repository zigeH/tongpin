import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { newUniqueCode } from "../../lib/code";

export const share = mutation({
  args: {
    boxId: v.id("boxes"),
    userId: v.id("users"),
    receiverIds: v.array(v.id("users")),
    senderNote: v.optional(v.string()),
  },
  handler: async (ctx, { boxId, userId, receiverIds, senderNote }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    if (box.senderId !== userId) fail("NOT_SENDER");
    if (box.status === "preparing") fail("NOT_READY");
    if (box.status !== "ready" || box.receiverId !== undefined) {
      fail("WRONG_STATUS", `当前状态 ${box.status}，只能分享还没人认领的 ready 盒子`);
    }
    const unique = [...new Set(receiverIds)];
    if (unique.includes(userId)) fail("INVALID_INPUT", "不能分享给自己");
    for (const id of unique) {
      if ((await ctx.db.get(id)) === null) fail("USER_NOT_FOUND", `好友 ${id} 不存在`);
    }

    await ctx.db.patch(boxId, { shared: true, ...(senderNote === undefined ? {} : { senderNote }) });
    const note = senderNote ?? box.senderNote;

    const boxIds = [];
    for (const receiverId of unique) {
      const existing = await ctx.db
        .query("boxes")
        .withIndex("by_receiver", (q) => q.eq("receiverId", receiverId))
        .filter((q) => q.eq(q.field("sharedFrom"), boxId))
        .first();
      boxIds.push(
        existing?._id ??
          (await ctx.db.insert("boxes", {
            code: await newUniqueCode(ctx),
            senderId: userId,
            receiverId,
            status: "ready",
            sharedFrom: boxId,
            senderNote: note,
            photoId: box.photoId,
            cutoutId: box.cutoutId,
            modelId: box.modelId,
          })),
      );
    }
    return { boxIds };
  },
});
