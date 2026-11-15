import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { fail } from "./lib/errors";

const VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export const save = mutation({
  args: { boxId: v.id("boxes"), storageId: v.id("_storage") },
  handler: async (ctx, { boxId, storageId }) => {
    if ((await ctx.db.get(boxId)) === null) fail("BOX_NOT_FOUND");
    const file = await ctx.db.system.get(storageId);
    if (file === null || !VIDEO_TYPES.includes(file.contentType ?? "")) {
      fail("INVALID_INPUT", "开箱视频只接受 video/mp4 或 video/quicktime");
    }
    const exportId = await ctx.db.insert("exports", { boxId, videoId: storageId, createdAt: Date.now() });
    return { exportId };
  },
});
