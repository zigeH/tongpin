/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { SAMPLE_GLB_URL } from "../convex/lib/mock";
import { toBoxView } from "../convex/lib/view";

const modules = import.meta.glob("../convex/**/*.*s");

const EDIT_FIELDS = [
  "snapshotId", "sceneShotId", "cameraPose", "prompt", "extraPhotoId",
  "editedImageId", "editedModelId", "receiverNote", "sealedAt",
] as const;
const EDIT_URLS = [
  "snapshotUrl", "sceneShotUrl", "extraPhotoUrl", "editedImageUrl", "editedModelUrl",
] as const;

const fetchMock = vi.fn(async (_url: string) => new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46])));

beforeEach(() => {
  process.env.MOCK_AI = "1";
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function snapshot(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    users: await ctx.db.query("users").collect(),
    boxes: await ctx.db.query("boxes").collect(),
    exports: await ctx.db.query("exports").collect(),
    files: await ctx.db.system.query("_storage").collect(),
  }));
}

describe("seed.demo", () => {
  test("creates 演示A, 演示B, a ready box and a sealed box with MOCK assets", async () => {
    const t = convexTest(schema, modules);
    const res = await t.action(api.seed.demo, {});
    expect(fetchMock).toHaveBeenCalledWith(SAMPLE_GLB_URL);
    expect(res.readyBox.code).toMatch(/^\d{6}$/);
    expect(res.sealedBox.code).toMatch(/^\d{6}$/);
    expect(res.readyBox.code).not.toBe(res.sealedBox.code);

    const { users, boxes } = await snapshot(t);
    expect(users.map((u) => u.nickname).sort()).toEqual(["演示A", "演示B"]);
    expect(users.find((u) => u._id === res.userAId)!.nickname).toBe("演示A");
    expect(users.find((u) => u._id === res.userBId)!.nickname).toBe("演示B");

    const ready = boxes.find((b) => b._id === res.readyBox.boxId)!;
    expect(ready).toMatchObject({ status: "ready", code: res.readyBox.code, senderId: res.userAId, receiverId: res.userBId });
    expect(ready.cutoutId).toBeDefined();
    expect(ready.modelId).toBeDefined();
    for (const key of EDIT_FIELDS) expect(ready).not.toHaveProperty(key);

    const sealed = boxes.find((b) => b._id === res.sealedBox.boxId)!;
    expect(sealed).toMatchObject({ status: "sealed", code: res.sealedBox.code, senderId: res.userAId, receiverId: res.userBId });
    for (const key of EDIT_FIELDS) expect(sealed[key]).toBeDefined();
    expect(sealed.editError).toBeUndefined();
    expect(sealed.openedAt).toBeUndefined();

    const types = await t.run(async (ctx) => {
      const type = async (id?: Id<"_storage">) => ((await ctx.db.system.get(id!)) as { contentType?: string }).contentType;
      return {
        photo: await type(ready.photoId),
        model: await type(ready.modelId),
        snapshot: await type(sealed.snapshotId),
        editedModel: await type(sealed.editedModelId),
      };
    });
    expect(types).toEqual({ photo: "image/png", model: "model/gltf-binary", snapshot: "image/png", editedModel: "model/gltf-binary" });
  });

  test("each phone sees its box per the inbox rules, and A cannot peek before opening", async () => {
    const t = convexTest(schema, modules);
    const res = await t.action(api.seed.demo, {});
    const { boxes } = await snapshot(t);

    const receivedByB = boxes.filter((b) => b.receiverId === res.userBId && ["ready", "claimed", "editing", "edited"].includes(b.status));
    expect(receivedByB.map((b) => b._id)).toEqual([res.readyBox.boxId]);
    const toOpenByA = boxes.filter((b) => b.senderId === res.userAId && b.status === "sealed");
    expect(toOpenByA.map((b) => b._id)).toEqual([res.sealedBox.boxId]);

    const views = await t.run(async (ctx) => {
      const sealed = (await ctx.db.get(res.sealedBox.boxId))!;
      return {
        a: await toBoxView(ctx, sealed, res.userAId),
        b: await toBoxView(ctx, sealed, res.userBId),
        aOpened: await toBoxView(ctx, { ...sealed, status: "opened", openedAt: Date.now() }, res.userAId),
      };
    });
    expect(views.a.modelUrl).toMatch(/^https?:/);
    for (const key of EDIT_URLS) expect(views.a).not.toHaveProperty(key);
    for (const key of EDIT_URLS) expect(views.b[key]).toMatch(/^https?:/);
    for (const key of EDIT_URLS) expect(views.aOpened[key]).toMatch(/^https?:/);
    expect(views.aOpened.prompt).toBe("给它戴一顶草帽");
    expect(views.aOpened.receiverNote).toBeTruthy();
  });

  test("rerunning deletes the previous demo data and leaves other data alone", async () => {
    const t = convexTest(schema, modules);
    const first = await t.action(api.seed.demo, {});
    const other = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { nickname: "路人", color: "#000", createdAt: 0 });
      const photoId = await ctx.storage.store(new Blob(["p"], { type: "image/jpeg" }));
      const boxId = await ctx.db.insert("boxes", { code: "999999", senderId: userId, status: "preparing", photoId });
      const sealed = (await ctx.db.get(first.sealedBox.boxId))!;
      const replyId = await ctx.db.insert("boxes", {
        code: "888888", senderId: first.userBId, receiverId: first.userAId, status: "ready", replyTo: sealed._id,
        photoId: sealed.editedImageId!, cutoutId: sealed.editedImageId!, modelId: sealed.editedModelId!,
      });
      const videoId = await ctx.storage.store(new Blob(["v"], { type: "video/mp4" }));
      await ctx.db.insert("exports", { boxId: sealed._id, videoId, createdAt: 0 });
      return { userId, boxId, photoId, replyId };
    });
    const second = await t.action(api.seed.demo, {});
    const after = await snapshot(t);

    expect(after.users.filter((u) => u.nickname.startsWith("演示")).map((u) => u._id).sort())
      .toEqual([second.userAId, second.userBId].sort());
    expect(after.users.some((u) => u._id === first.userAId)).toBe(false);
    expect(after.boxes.map((b) => b._id).sort()).toEqual([other.boxId, second.readyBox.boxId, second.sealedBox.boxId].sort());
    expect(after.exports).toEqual([]);
    expect(after.users.some((u) => u._id === other.userId)).toBe(true);
    expect(after.files.some((f) => f._id === other.photoId)).toBe(true);
    const secondSealed = after.boxes.find((b) => b._id === second.sealedBox.boxId)!;
    expect(after.files.map((f) => f._id).sort())
      .toEqual([other.photoId, secondSealed.photoId, secondSealed.modelId!].sort());
  });

  test("uses passed asset storageIds and keeps them on rerun", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const img = (type: string) => ctx.storage.store(new Blob(["i"], { type }));
      const glb = () => ctx.storage.store(new Blob(["g"], { type: "model/gltf-binary" }));
      return {
        photoId: await img("image/jpeg"), cutoutId: await img("image/png"), modelId: await glb(),
        snapshotId: await img("image/png"), sceneShotId: await img("image/jpeg"), extraPhotoId: await img("image/jpeg"),
        editedImageId: await img("image/png"), editedModelId: await glb(),
      };
    });

    const res = await t.action(api.seed.demo, ids);
    expect(fetchMock).not.toHaveBeenCalled();
    let { boxes, files } = await snapshot(t);
    const sealed = boxes.find((b) => b._id === res.sealedBox.boxId)! as Doc<"boxes">;
    for (const [key, id] of Object.entries(ids)) expect(sealed[key as keyof Doc<"boxes">]).toBe(id);
    const ready = boxes.find((b) => b._id === res.readyBox.boxId)!;
    expect([ready.photoId, ready.cutoutId, ready.modelId]).toEqual([ids.photoId, ids.cutoutId, ids.modelId]);
    expect(files.length).toBe(8);

    await t.action(api.seed.demo, ids);
    ({ files } = await snapshot(t));
    expect(files.map((f) => f._id).sort()).toEqual((Object.values(ids) as Id<"_storage">[]).sort());
  });

  test("partial assets fall back to MOCK defaults for the rest", async () => {
    const t = convexTest(schema, modules);
    const modelId = await t.run((ctx) => ctx.storage.store(new Blob(["g"], { type: "model/gltf-binary" })));
    const res = await t.action(api.seed.demo, { modelId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const ready = await t.run(async (ctx) => (await ctx.db.get(res.readyBox.boxId))!);
    expect(ready.modelId).toBe(modelId);
    expect(ready.photoId).toBeDefined();
  });
});
