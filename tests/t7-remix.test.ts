/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.*s");

process.env.MOCK_AI = "1";

async function errorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  return undefined;
}

async function seedOpened(t: ReturnType<typeof convexTest>, fields: Partial<Doc<"boxes">> = {}) {
  return t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const b = await ctx.db.insert("users", { nickname: "B", color: "#0f0", createdAt: 0 });
    const file = (type = "image/png") => ctx.storage.store(new Blob(["x"], { type }));
    const boxId = await ctx.db.insert("boxes", {
      code: "000001",
      senderId: a,
      receiverId: b,
      status: "opened",
      photoId: await file("image/jpeg"),
      cutoutId: await file(),
      modelId: await file("model/gltf-binary"),
      snapshotId: await file(),
      cameraPose: { position: [0, 1, 2], target: [0, 0, 0], fov: 50 },
      prompt: "戴帽子",
      editedImageId: await file(),
      editedModelId: await file("model/gltf-binary"),
      receiverNote: "开吧",
      sealedAt: 1,
      openedAt: 2,
      ...fields,
    });
    return { a, b, boxId };
  });
}

const storageCount = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length);
const scheduledCount = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).length);

describe("boxes.remixBack", () => {
  test("creates a claimed box for A from B's edits, sender B, no regeneration", async () => {
    const t = convexTest(schema, modules);
    const { a, b, boxId } = await seedOpened(t);
    const filesBefore = await storageCount(t);

    const { boxId: newId } = await t.mutation(api.boxes.remixBack, { boxId, userId: a });

    const [oldBox, newBox] = await t.run(async (ctx) => [await ctx.db.get(boxId), await ctx.db.get(newId)]);
    expect(newBox).toMatchObject({
      senderId: b,
      receiverId: a,
      status: "claimed",
      replyTo: boxId,
      photoId: oldBox!.editedImageId,
      cutoutId: oldBox!.editedImageId,
      modelId: oldBox!.editedModelId,
    });
    expect(newBox!.code).toMatch(/^\d{6}$/);
    expect(newBox!.code).not.toBe(oldBox!.code);
    for (const k of ["snapshotId", "editedImageId", "editedModelId", "prompt", "editError", "sealedAt", "openedAt", "senderNote"]) {
      expect(newBox).not.toHaveProperty(k);
    }
    expect(await storageCount(t)).toBe(filesBefore);
    expect(await scheduledCount(t)).toBe(0);

    const view = await t.query(api.boxes.get, { boxId: newId, viewerId: a });
    expect(view.photoUrl).toBeTruthy();
    expect(view.modelUrl).toBeTruthy();
  });

  test("repeat call returns the same new box", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedOpened(t);
    const first = await t.mutation(api.boxes.remixBack, { boxId, userId: a });
    expect(await t.mutation(api.boxes.remixBack, { boxId, userId: a })).toEqual(first);
    expect(await t.run(async (ctx) => (await ctx.db.query("boxes").collect()).length)).toBe(2);
  });

  test("non-sender gets NOT_SENDER", async () => {
    const t = convexTest(schema, modules);
    const { b, boxId } = await seedOpened(t);
    expect(await errorCode(t.mutation(api.boxes.remixBack, { boxId, userId: b }))).toBe("NOT_SENDER");
  });

  test("old box not opened gets WRONG_STATUS", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedOpened(t, { status: "sealed", openedAt: undefined });
    expect(await errorCode(t.mutation(api.boxes.remixBack, { boxId, userId: a }))).toBe("WRONG_STATUS");
  });

  test("old box missing edited results gets WRONG_STATUS", async () => {
    const t = convexTest(schema, modules);
    const noModel = await seedOpened(t, { editedModelId: undefined });
    expect(await errorCode(t.mutation(api.boxes.remixBack, { boxId: noModel.boxId, userId: noModel.a }))).toBe("WRONG_STATUS");
    const noImage = await seedOpened(t, { editedImageId: undefined });
    expect(await errorCode(t.mutation(api.boxes.remixBack, { boxId: noImage.boxId, userId: noImage.a }))).toBe("WRONG_STATUS");
  });

  test("missing box gets BOX_NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedOpened(t);
    await t.run((ctx) => ctx.db.delete(boxId));
    expect(await errorCode(t.mutation(api.boxes.remixBack, { boxId, userId: a }))).toBe("BOX_NOT_FOUND");
  });

  test("relay: A edits and seals, B sees open, B opens and can remix back again", async () => {
    const t = convexTest(schema, modules);
    const { a, b, boxId } = await seedOpened(t);
    const { boxId: second } = await t.mutation(api.boxes.remixBack, { boxId, userId: a });

    const aInbox = await t.query(api.boxes.inbox, { userId: a });
    expect(aInbox.received.find((box) => box._id === second)?.action).toBe("edit");
    const bBefore = await t.query(api.boxes.inbox, { userId: b });
    expect(bBefore.received.some((box) => box._id === second)).toBe(false);
    const bSent = bBefore.sent.find((box) => box._id === second);
    expect(bSent?.status).toBe("claimed");

    await t.run(async (ctx) => {
      const file = (type = "image/png") => ctx.storage.store(new Blob(["y"], { type }));
      await ctx.db.patch(second, {
        status: "edited",
        snapshotId: await file(),
        cameraPose: { position: [0, 1, 2], target: [0, 0, 0], fov: 50 },
        prompt: "再加一朵花",
        editedImageId: await file(),
        editedModelId: await file("model/gltf-binary"),
      });
    });
    await t.mutation(api.boxes.seal, { boxId: second, userId: a, receiverNote: "接力" });

    const bAfter = await t.query(api.boxes.inbox, { userId: b });
    expect(bAfter.received.find((box) => box._id === second)?.action).toBe("open");
    const opened = await t.mutation(api.boxes.open, { boxId: second, userId: b });
    expect(opened.prompt).toBe("再加一朵花");

    const { boxId: third } = await t.mutation(api.boxes.remixBack, { boxId: second, userId: b });
    const thirdBox = await t.run((ctx) => ctx.db.get(third));
    expect(thirdBox).toMatchObject({ senderId: a, receiverId: b, status: "claimed", replyTo: second });
  });
});

describe("exports.save", () => {
  async function setup(type: string) {
    const t = convexTest(schema, modules);
    const { boxId } = await seedOpened(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["v"], { type })));
    return { t, boxId, storageId };
  }

  for (const type of ["video/mp4", "video/quicktime"]) {
    test(`accepts ${type}`, async () => {
      const { t, boxId, storageId } = await setup(type);
      const { exportId } = await t.mutation(api.exports.save, { boxId, storageId });
      const row = await t.run((ctx) => ctx.db.get(exportId as Id<"exports">));
      expect(row).toMatchObject({ boxId, videoId: storageId });
      expect(typeof row!.createdAt).toBe("number");
    });
  }

  test("rejects non-video with INVALID_INPUT", async () => {
    const { t, boxId, storageId } = await setup("image/png");
    expect(await errorCode(t.mutation(api.exports.save, { boxId, storageId }))).toBe("INVALID_INPUT");
    expect(await t.run(async (ctx) => (await ctx.db.query("exports").collect()).length)).toBe(0);
  });

  test("missing box gets BOX_NOT_FOUND", async () => {
    const { t, boxId, storageId } = await setup("video/mp4");
    await t.run((ctx) => ctx.db.delete(boxId));
    expect(await errorCode(t.mutation(api.exports.save, { boxId, storageId }))).toBe("BOX_NOT_FOUND");
  });
});
