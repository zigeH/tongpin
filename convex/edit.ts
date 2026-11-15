import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { fail as failWith } from "./lib/errors";
import { removeBackground } from "./lib/cutout";
import { directRemix } from "./lib/director";
import { isMock } from "./lib/mock";
import { assertStatus } from "./lib/status";

const DEFAULT_IMAGE_MODEL = "gpt-image-2.6-flare";

export function buildEditPrompt(instruction: string, hasExtraPhoto: boolean, direction?: string): string {
  return [
    `The first image is a 3D object on a transparent background. Edit this object according to the user's request: "${instruction}".`,
    direction ? `Art direction (follow closely): ${direction}` : "",
    hasExtraPhoto ? "Incorporate the subject from the second image into the object as part of it, not as a separate item." : "",
    "Requirements: the result is exactly one standalone object; any added items are physically attached to it or worn by it.",
    "Show the whole object fully inside the frame with some empty margin, centered, same camera angle, scale and lighting as the input.",
    "Keep the original object recognizable unless the request asks to transform it.",
    "Transparent background: no floor, no ground shadow, no scenery, no props, no text, no frame or border.",
  ].filter(Boolean).join(" ");
}

async function openaiEdit(prompt: string, images: Blob[]): Promise<Blob> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 未配置");
  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL);
  form.append("prompt", prompt);
  images.forEach((image, i) => form.append("image[]", image, `image${i}.${image.type === "image/jpeg" ? "jpg" : "png"}`));
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("quality", "medium");
  form.append("size", "1024x1024");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI 返回 ${res.status}：${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 返回里没有图片");
  return new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/png" });
}

export const getBox = internalQuery({
  args: { boxId: v.id("boxes") },
  handler: (ctx, { boxId }) => ctx.db.get(boxId),
});

export const setEditedImage = internalMutation({
  args: { boxId: v.id("boxes"), editedImageId: v.id("_storage") },
  handler: async (ctx, { boxId, editedImageId }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) failWith("BOX_NOT_FOUND");
    assertStatus(box, "editing");
    await ctx.db.patch(boxId, { editedImageId, editError: undefined });
    await ctx.scheduler.runAfter(0, internal.kara.request, { boxId, kind: "edited" });
  },
});

export const fail = internalMutation({
  args: { boxId: v.id("boxes"), reason: v.string() },
  handler: async (ctx, { boxId, reason }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) failWith("BOX_NOT_FOUND");
    assertStatus(box, "editing");
    await ctx.db.patch(boxId, { status: "claimed", editError: `改造失败：${reason}` });
  },
});

export const run = internalAction({
  args: { boxId: v.id("boxes") },
  handler: async (ctx, { boxId }): Promise<null> => {
    const box: Doc<"boxes"> | null = await ctx.runQuery(internal.edit.getBox, { boxId });
    if (box === null) failWith("BOX_NOT_FOUND");
    assertStatus(box, "editing");
    const snapshotId = box.snapshotId;
    if (snapshotId === undefined) failWith("INVALID_INPUT", "缺少定格图");

    let editedImageId: Id<"_storage">;
    try {
      if (isMock()) {
        editedImageId = snapshotId;
      } else {
        const snapshot = await ctx.storage.get(snapshotId);
        if (snapshot === null) throw new Error("定格图不存在");
        const extra = box.extraPhotoId ? await ctx.storage.get(box.extraPhotoId) : null;
        // 导演：先把一句话扩写成具体的改图指导（失败时为 null，直接用原句）
        const plan = await directRemix(box.prompt ?? "", extra !== null);
        const edited = await openaiEdit(buildEditPrompt(box.prompt ?? "", extra !== null, plan?.direction), extra ? [snapshot, extra] : [snapshot]);
        const rawId = await ctx.storage.store(edited);
        if (process.env.EDIT_FAL_CUTOUT !== "1") {
          editedImageId = rawId;
        } else {
          const rawUrl = await ctx.storage.getUrl(rawId);
          if (rawUrl === null) throw new Error("改图结果存储失败");
          let cutout: Blob;
          try {
            cutout = await removeBackground(rawUrl);
          } finally {
            await ctx.storage.delete(rawId);
          }
          editedImageId = await ctx.storage.store(cutout);
        }
      }
    } catch (e) {
      await ctx.runMutation(internal.edit.fail, { boxId, reason: e instanceof Error ? e.message : String(e) });
      return null;
    }
    await ctx.runMutation(internal.edit.setEditedImage, { boxId, editedImageId });
    return null;
  },
});
