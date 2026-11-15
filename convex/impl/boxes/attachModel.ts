import { mutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import { modelKind } from "../../lib/status";
import { assertAttachable, attachToBox } from "../../kara";

export const attachModel = mutation({
  args: {
    boxId: v.id("boxes"),
    kind: modelKind,
    modelStorageId: v.optional(v.id("_storage")),
    modelUrl: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, { boxId, kind, modelStorageId, modelUrl, token }) => {
    const expectedToken = process.env.KARA_TOKEN;
    if (expectedToken && token !== expectedToken) fail("INVALID_INPUT", "token 不对");
    if ((modelStorageId === undefined) === (modelUrl === undefined)) {
      fail("INVALID_INPUT", "modelStorageId 和 modelUrl 必须且只能传一个");
    }
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");

    if (modelStorageId !== undefined) {
      if ((await ctx.db.system.get(modelStorageId)) === null) fail("INVALID_INPUT", "modelStorageId 不存在");
      await attachToBox(ctx, boxId, kind, modelStorageId);
      return null;
    }

    if (!/^https?:\/\//.test(modelUrl!)) fail("INVALID_INPUT", "modelUrl 必须是 http(s) 地址");
    assertAttachable(box, kind);
    await ctx.scheduler.runAfter(0, internal.kara.download, { boxId, kind, url: modelUrl! });
    return null;
  },
});
