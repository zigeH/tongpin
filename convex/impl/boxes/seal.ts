import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { assertStatus } from "../../lib/status";

export const seal = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users"), receiverNote: v.string() },
  handler: async (ctx, { boxId, userId, receiverNote }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    if (box.receiverId !== userId) fail("NOT_RECEIVER");
    assertStatus(box, "edited");
    await ctx.db.patch(boxId, { receiverNote, sealedAt: Date.now(), status: "sealed" });
    return null;
  },
});
