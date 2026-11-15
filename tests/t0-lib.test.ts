/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import type { Doc } from "../convex/_generated/dataModel";
import { ALLOWED_TRANSITIONS, assertStatus } from "../convex/lib/status";
import { newUniqueCode } from "../convex/lib/code";
import { toBoxView } from "../convex/lib/view";

const modules = import.meta.glob("../convex/**/*.*s");

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  return undefined;
}

afterEach(() => vi.restoreAllMocks());

describe("assertStatus", () => {
  test("allowed status passes", () => {
    expect(errorCode(() => assertStatus({ status: "claimed" as const }, "claimed", "edited"))).toBeUndefined();
  });

  test("other status throws WRONG_STATUS", () => {
    expect(errorCode(() => assertStatus({ status: "ready" as const }, "claimed", "edited"))).toBe("WRONG_STATUS");
  });

  test("transition table matches the plan", () => {
    expect(ALLOWED_TRANSITIONS.new).toEqual(["preparing", "ready", "claimed"]);
    expect(ALLOWED_TRANSITIONS.editing).toEqual(["edited", "claimed"]);
    expect(ALLOWED_TRANSITIONS.edited).toEqual(["editing", "sealed"]);
    expect(ALLOWED_TRANSITIONS.opened).toEqual([]);
  });
});

async function seedBox(t: ReturnType<typeof convexTest>, fields: Partial<Doc<"boxes">> = {}) {
  return t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const b = await ctx.db.insert("users", { nickname: "B", color: "#0f0", createdAt: 0 });
    const file = () => ctx.storage.store(new Blob(["x"], { type: "image/png" }));
    const boxId = await ctx.db.insert("boxes", {
      code: "000001",
      senderId: a,
      receiverId: b,
      status: "sealed",
      photoId: await file(),
      cutoutId: await file(),
      modelId: await file(),
      snapshotId: await file(),
      sceneShotId: await file(),
      cameraPose: { position: [0, 1, 2], target: [0, 0, 0], fov: 50 },
      prompt: "戴帽子",
      extraPhotoId: await file(),
      editedImageId: await file(),
      editedModelId: await file(),
      receiverNote: "开吧",
      sealedAt: 1,
      ...fields,
    });
    return { a, b, boxId };
  });
}

const EDIT_FIELDS = [
  "snapshotUrl", "sceneShotUrl", "cameraPose", "prompt", "extraPhotoUrl",
  "editedImageUrl", "editedModelUrl", "receiverNote", "editError", "sealedAt", "openedAt",
];

describe("newUniqueCode", () => {
  test("returns a 6-digit code", async () => {
    const t = convexTest(schema, modules);
    const code = await t.run((ctx) => newUniqueCode(ctx));
    expect(code).toMatch(/^\d{6}$/);
  });

  test("retries when the code is taken", async () => {
    const t = convexTest(schema, modules);
    await seedBox(t, { code: "000001" });
    vi.spyOn(Math, "random").mockReturnValueOnce(0.000001).mockReturnValueOnce(0.5);
    const code = await t.run((ctx) => newUniqueCode(ctx));
    expect(code).toBe("500000");
  });

  test("gives up after 10 collisions", async () => {
    const t = convexTest(schema, modules);
    await seedBox(t, { code: "000001" });
    vi.spyOn(Math, "random").mockReturnValue(0.000001);
    await expect(t.run((ctx) => newUniqueCode(ctx))).rejects.toThrow();
  });
});

describe("toBoxView", () => {
  test("sender before opening sees no edit fields", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedBox(t, { editError: "x" });
    const view = await t.run(async (ctx) => toBoxView(ctx, (await ctx.db.get(boxId))!, a));
    for (const key of EDIT_FIELDS) expect(view).not.toHaveProperty(key);
    expect(view.photoUrl).toMatch(/^https?:/);
    expect(view.modelUrl).toMatch(/^https?:/);
    expect(view.senderNickname).toBe("A");
    expect(view.receiverNickname).toBe("B");
  });

  test("receiver sees edit fields as urls", async () => {
    const t = convexTest(schema, modules);
    const { b, boxId } = await seedBox(t);
    const view = await t.run(async (ctx) => toBoxView(ctx, (await ctx.db.get(boxId))!, b));
    expect(view.snapshotUrl).toMatch(/^https?:/);
    expect(view.editedModelUrl).toMatch(/^https?:/);
    expect(view.prompt).toBe("戴帽子");
    expect(view.cameraPose).toEqual({ position: [0, 1, 2], target: [0, 0, 0], fov: 50 });
    expect(view).not.toHaveProperty("photoId");
  });

  test("sender sees everything after opening", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedBox(t, { status: "opened", openedAt: 2 });
    const view = await t.run(async (ctx) => toBoxView(ctx, (await ctx.db.get(boxId))!, a));
    expect(view.editedImageUrl).toMatch(/^https?:/);
    expect(view.receiverNote).toBe("开吧");
    expect(view.openedAt).toBe(2);
  });

  test("sender still sees the cutout error while preparing", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedBox(t, { status: "preparing", editError: "抠图失败：x" });
    const view = await t.run(async (ctx) => toBoxView(ctx, (await ctx.db.get(boxId))!, a));
    expect(view.editError).toBe("抠图失败：x");
    expect(view).not.toHaveProperty("snapshotUrl");
  });
});
