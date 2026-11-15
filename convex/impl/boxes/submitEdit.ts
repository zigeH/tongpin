import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { cameraPose } from "../../schema";

export const submitEdit = mutation({
  args: {
    boxId: v.id("boxes"),
    userId: v.id("users"),
    snapshotStorageId: v.id("_storage"),
    sceneShotStorageId: v.optional(v.id("_storage")),
    cameraPose,
    prompt: v.string(),
    extraPhotoStorageId: v.optional(v.id("_storage")),
  },
  handler: async () => null,
});
