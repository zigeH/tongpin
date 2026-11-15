import { mutation } from "../../_generated/server";
import { v } from "convex/values";

export const seal = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users"), receiverNote: v.string() },
  handler: async () => null,
});
