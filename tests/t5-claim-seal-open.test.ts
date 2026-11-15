/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { toBoxView } from "../convex/lib/view";

const modules = import.meta.glob("../convex/**/*.*s");

beforeEach(() => vi.stubEnv("MOCK_AI", "1"));

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  throw new Error("expected an error");
}

async function setup(fields: Partial<Doc<"boxes">> = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const b = await ctx.db.insert("users", { nickname: "B", color: "#0f0", createdAt: 0 });
    const c = await ctx.db.insert("users", { nickname: "C", color: "#00f", createdAt: 0 });
    const file = (type = "image/png") => ctx.storage.store(new Blob(["x"], { type }));
    const boxId = await ctx.db.insert("boxes", {
      code: "123456",
      senderId: a,
      status: "ready",
      photoId: await file("image/jpeg"),
      cutoutId: await file(),
      modelId: await file("model/gltf-binary"),
      ...fields,
    });
    return { a, b, c, boxId };
  });
  const box = () => t.run(async (ctx) => (await ctx.db.get(ids.boxId))!);
  return { t, ...ids, box };
}

async function fillEdits(t: ReturnType<typeof convexTest>, boxId: Id<"boxes">) {
  await t.run(async (ctx) => {
    const file = (type = "image/png") => ctx.storage.store(new Blob(["x"], { type }));
    await ctx.db.patch(boxId, {
      snapshotId: await file(),
      sceneShotId: await file("image/jpeg"),
      cameraPose: { position: [0, 1, 3], target: [0, 0, 0], fov: 50 },
      prompt: "戴一顶草帽",
      extraPhotoId: await file("image/jpeg"),
      editedImageId: await file(),
      editedModelId: await file("model/gltf-binary"),
      status: "edited",
    });
  });
}

describe("boxes.claim", () => {
  test("1. unknown code -> BOX_NOT_FOUND", async () => {
    const { t, b } = await setup();
    expect(await codeOf(t.mutation(api.boxes.claim, { code: "999999", userId: b }))).toBe("BOX_NOT_FOUND");
  });

  test("2. sender claims own box -> INVALID_INPUT", async () => {
    const { t, a, box } = await setup();
    expect(await codeOf(t.mutation(api.boxes.claim, { code: "123456", userId: a }))).toBe("INVALID_INPUT");
    expect((await box()).status).toBe("ready");
  });

  test("3. claimed by someone else -> ALREADY_CLAIMED", async () => {
    const { t, b, c, box } = await setup();
    await t.mutation(api.boxes.claim, { code: "123456", userId: b });
    expect(await codeOf(t.mutation(api.boxes.claim, { code: "123456", userId: c }))).toBe("ALREADY_CLAIMED");
    expect((await box()).receiverId).toBe(b);
  });

  test("4. same receiver claims again -> same boxId, no error", async () => {
    const { t, b, boxId, box } = await setup();
    expect(await t.mutation(api.boxes.claim, { code: "123456", userId: b })).toEqual({ boxId });
    expect(await t.mutation(api.boxes.claim, { code: "123456", userId: b })).toEqual({ boxId });
    await t.run((ctx) => ctx.db.patch(boxId, { status: "sealed" }));
    expect(await t.mutation(api.boxes.claim, { code: "123456", userId: b })).toEqual({ boxId });
    expect((await box()).status).toBe("sealed");
  });

  test("5. box not ready yet -> NOT_READY", async () => {
    const { t, b, box } = await setup({ status: "preparing", modelId: undefined });
    expect(await codeOf(t.mutation(api.boxes.claim, { code: "123456", userId: b }))).toBe("NOT_READY");
    expect((await box()).receiverId).toBeUndefined();
  });

  test("6. ready box -> claimed with receiverId", async () => {
    const { t, b, boxId, box } = await setup();
    expect(await t.mutation(api.boxes.claim, { code: " 123456 ", userId: b })).toEqual({ boxId });
    const after = await box();
    expect(after.status).toBe("claimed");
    expect(after.receiverId).toBe(b);
  });

  test("6. reply box with prefilled receiverId -> claimed by that receiver", async () => {
    const { t, b, c, boxId, box } = await setup({ receiverId: undefined });
    await t.run((ctx) => ctx.db.patch(boxId, { receiverId: b }));
    expect(await codeOf(t.mutation(api.boxes.claim, { code: "123456", userId: c }))).toBe("ALREADY_CLAIMED");
    expect(await t.mutation(api.boxes.claim, { code: "123456", userId: b })).toEqual({ boxId });
    expect((await box()).status).toBe("claimed");
  });

  test("deleted user -> USER_NOT_FOUND", async () => {
    const { t, c, box } = await setup();
    await t.run((ctx) => ctx.db.delete(c));
    expect(await codeOf(t.mutation(api.boxes.claim, { code: "123456", userId: c }))).toBe("USER_NOT_FOUND");
    expect((await box()).receiverId).toBeUndefined();
  });
});

describe("boxes.seal", () => {
  test("non-receiver -> NOT_RECEIVER", async () => {
    const { t, a, b, c, boxId } = await setup({ status: "claimed" });
    await t.run((ctx) => ctx.db.patch(boxId, { receiverId: b }));
    await fillEdits(t, boxId);
    expect(await codeOf(t.mutation(api.boxes.seal, { boxId, userId: a, receiverNote: "x" }))).toBe("NOT_RECEIVER");
    expect(await codeOf(t.mutation(api.boxes.seal, { boxId, userId: c, receiverNote: "x" }))).toBe("NOT_RECEIVER");
  });

  test("before edited -> WRONG_STATUS", async () => {
    const { t, b, boxId } = await setup();
    await t.mutation(api.boxes.claim, { code: "123456", userId: b });
    expect(await codeOf(t.mutation(api.boxes.seal, { boxId, userId: b, receiverNote: "x" }))).toBe("WRONG_STATUS");
    await t.run((ctx) => ctx.db.patch(boxId, { status: "editing" }));
    expect(await codeOf(t.mutation(api.boxes.seal, { boxId, userId: b, receiverNote: "x" }))).toBe("WRONG_STATUS");
  });

  test("edited -> sealed with note and sealedAt", async () => {
    const { t, b, boxId, box } = await setup();
    await t.mutation(api.boxes.claim, { code: "123456", userId: b });
    await fillEdits(t, boxId);
    expect(await t.mutation(api.boxes.seal, { boxId, userId: b, receiverNote: "改好了" })).toBeNull();
    const after = await box();
    expect(after.status).toBe("sealed");
    expect(after.receiverNote).toBe("改好了");
    expect(after.sealedAt).toBeTypeOf("number");
    expect(await codeOf(t.mutation(api.boxes.seal, { boxId, userId: b, receiverNote: "again" }))).toBe("WRONG_STATUS");
  });
});

describe("boxes.open", () => {
  async function sealedBox() {
    const s = await setup();
    await s.t.mutation(api.boxes.claim, { code: "123456", userId: s.b });
    await fillEdits(s.t, s.boxId);
    await s.t.mutation(api.boxes.seal, { boxId: s.boxId, userId: s.b, receiverNote: "开吧" });
    return s;
  }

  test("non-sender -> NOT_SENDER", async () => {
    const { t, b, boxId } = await sealedBox();
    expect(await codeOf(t.mutation(api.boxes.open, { boxId, userId: b }))).toBe("NOT_SENDER");
  });

  test("not sealed yet -> WRONG_STATUS", async () => {
    const { t, a, b, boxId } = await setup();
    await t.mutation(api.boxes.claim, { code: "123456", userId: b });
    await fillEdits(t, boxId);
    expect(await codeOf(t.mutation(api.boxes.open, { boxId, userId: a }))).toBe("WRONG_STATUS");
  });

  test("sealed -> opened, A sees every edit field; repeat open is a no-op", async () => {
    const { t, a, boxId, box } = await sealedBox();
    const before = await t.run(async (ctx) => toBoxView(ctx, (await ctx.db.get(boxId))!, a));
    expect(before).not.toHaveProperty("editedModelUrl");

    const view = await t.mutation(api.boxes.open, { boxId, userId: a });
    expect(view.status).toBe("opened");
    for (const key of ["snapshotUrl", "sceneShotUrl", "extraPhotoUrl", "editedImageUrl", "editedModelUrl"] as const) {
      expect(view[key]).toMatch(/^https?:/);
    }
    expect(view.cameraPose).toEqual({ position: [0, 1, 3], target: [0, 0, 0], fov: 50 });
    expect(view.prompt).toBe("戴一顶草帽");
    expect(view.receiverNote).toBe("开吧");
    expect(view.sealedAt).toBeTypeOf("number");
    expect(view.openedAt).toBeTypeOf("number");

    const fromGet = await t.run(async (ctx) => toBoxView(ctx, (await ctx.db.get(boxId))!, a));
    expect(fromGet).toEqual(view);

    const openedAt = (await box()).openedAt;
    const again = await t.mutation(api.boxes.open, { boxId, userId: a });
    expect(again.openedAt).toBe(openedAt);
  });

  test("unknown box -> BOX_NOT_FOUND", async () => {
    const { t, a, boxId } = await setup();
    await t.run((ctx) => ctx.db.delete(boxId));
    expect(await codeOf(t.mutation(api.boxes.open, { boxId, userId: a }))).toBe("BOX_NOT_FOUND");
    expect(await codeOf(t.mutation(api.boxes.seal, { boxId, userId: a, receiverNote: "x" }))).toBe("BOX_NOT_FOUND");
  });
});
