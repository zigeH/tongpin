import { query } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { toBoxView, type BoxView } from "../../lib/view";

export const get = query({
  args: { boxId: v.id("boxes"), viewerId: v.optional(v.id("users")) },
  handler: async (ctx, { boxId, viewerId }): Promise<BoxView> => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    return toBoxView(ctx, box, viewerId);
  },
});
