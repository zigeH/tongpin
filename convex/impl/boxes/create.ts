import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { FAKE_BOX_ID } from "../../lib/mock";

export const create = mutation({
  args: {
    userId: v.id("users"),
    photoStorageId: v.id("_storage"),
    senderNote: v.optional(v.string()),
  },
  handler: async () => ({ boxId: FAKE_BOX_ID }),
});
