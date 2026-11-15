import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const run = internalAction({
  args: { boxId: v.id("boxes") },
  handler: async () => null,
});
