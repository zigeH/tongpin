import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { fail } from "./lib/errors";
import { removeBackground } from "./lib/fal";
import { fakeCutoutBlob, isMock } from "./lib/mock";
import { assertStatus } from "./lib/status";

export const getBox = internalQuery({
  args: { boxId: v.id("boxes") },
  handler: (ctx, { boxId }) => ctx.db.get(boxId),
});

export const setCutout = internalMutation({
  args: { boxId: v.id("boxes"), cutoutId: v.id("_storage") },
  handler: async (ctx, { boxId, cutoutId }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    assertStatus(box, "preparing");
    await ctx.db.patch(boxId, { cutoutId, editError: undefined });
  },
});

export const setError = internalMutation({
  args: { boxId: v.id("boxes"), reason: v.string() },
  handler: async (ctx, { boxId, reason }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    assertStatus(box, "preparing");
    await ctx.db.patch(boxId, { editError: `抠图失败：${reason}` });
  },
});

export const run = internalAction({
  args: { boxId: v.id("boxes") },
  handler: async (ctx, { boxId }): Promise<null> => {
    const box: Doc<"boxes"> | null = await ctx.runQuery(internal.prepare.getBox, { boxId });
    if (box === null) fail("BOX_NOT_FOUND");
    assertStatus(box, "preparing");

    let blob: Blob;
    if (isMock()) {
      blob = fakeCutoutBlob();
    } else {
      const photoUrl = await ctx.storage.getUrl(box.photoId);
      if (photoUrl === null) {
        await ctx.runMutation(internal.prepare.setError, { boxId, reason: "原图不存在" });
        return null;
      }
      let result: Blob | undefined;
      let reason = "";
      for (let attempt = 0; attempt < 2 && result === undefined; attempt++) {
        try {
          result = await removeBackground(photoUrl);
        } catch (e) {
          reason = e instanceof Error ? e.message : String(e);
        }
      }
      if (result === undefined) {
        await ctx.runMutation(internal.prepare.setError, { boxId, reason });
        return null;
      }
      blob = result;
    }

    const cutoutId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.prepare.setCutout, { boxId, cutoutId });
    await ctx.scheduler.runAfter(0, internal.kara.request, { boxId, kind: "original" });
    return null;
  },
});
