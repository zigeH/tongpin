import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { assertStatus } from "../../lib/status";
import { toBoxView, type BoxView } from "../../lib/view";

export const open = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users") },
  handler: async (ctx, { boxId, userId }): Promise<BoxView> => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    if (box.senderId !== userId) fail("NOT_SENDER");
    if (box.status !== "opened") {
      assertStatus(box, "sealed");
      await ctx.db.patch(boxId, { openedAt: Date.now(), status: "opened" });
    }
    return toBoxView(ctx, (await ctx.db.get(boxId))!, userId);
  },
});
