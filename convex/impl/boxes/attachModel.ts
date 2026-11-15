import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { modelKind } from "../../lib/status";

export const attachModel = mutation({
  args: {
    boxId: v.id("boxes"),
    kind: modelKind,
    modelStorageId: v.optional(v.id("_storage")),
    modelUrl: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async () => null,
});
