import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const save = mutation({
  args: { boxId: v.id("boxes"), storageId: v.id("_storage") },
  handler: async () => ({ exportId: "fake_export" as Id<"exports"> }),
});
