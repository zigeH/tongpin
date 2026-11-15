import { action } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { FAKE_BOX_ID, FAKE_RECEIVER_ID, FAKE_USER_ID } from "./lib/mock";

export const demo = action({
  args: {
    photoId: v.optional(v.id("_storage")),
    cutoutId: v.optional(v.id("_storage")),
    modelId: v.optional(v.id("_storage")),
    snapshotId: v.optional(v.id("_storage")),
    sceneShotId: v.optional(v.id("_storage")),
    editedImageId: v.optional(v.id("_storage")),
    editedModelId: v.optional(v.id("_storage")),
  },
  handler: async (): Promise<{
    userAId: Id<"users">;
    userBId: Id<"users">;
    readyBox: { boxId: Id<"boxes">; code: string };
    sealedBox: { boxId: Id<"boxes">; code: string };
  }> => ({
    userAId: FAKE_USER_ID,
    userBId: FAKE_RECEIVER_ID,
    readyBox: { boxId: FAKE_BOX_ID, code: "111111" },
    sealedBox: { boxId: FAKE_BOX_ID, code: "222222" },
  }),
});
