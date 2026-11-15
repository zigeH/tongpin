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

async function setup(fields: Partial<Doc<"boxes">> = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (nickname: string, color: string) => ctx.db.insert("users", { nickname, color, createdAt: 0 });
    const a = await user("A", "#f00");
    const b = await user("B", "#0f0");
    const c = await user("C", "#00f");
    const d = await user("D", "#ff0");
    const file = (type = "image/png") => ctx.storage.store(new Blob(["x"], { type }));
    const boxId = await ctx.db.insert("boxes", {
      code: "111111",
      senderId: a,
      status: "ready",
      senderNote: "原留言",
      photoId: await file("image/jpeg"),
      cutoutId: await file(),
      modelId: await file("model/gltf-binary"),
      ...fields,
    });
    return { a, b, c, d, boxId };
  });
  const get = (id: Id<"boxes">) => t.run(async (ctx) => (await ctx.db.get(id))!);
  const count = () => t.run(async (ctx) => (await ctx.db.query("boxes").collect()).length);
  const storage = () => t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length);
  return { t, ...ids, get, count, storage };
}

describe("boxes.share", () => {
  test("one ready copy per friend, reusing files, with new codes and the note", async () => {
    const { t, a, b, c, boxId, get, storage } = await setup();
    const filesBefore = await storage();
    const { boxIds } = await t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b, c, b], senderNote: "改成任何东西" });
    expect(boxIds).toHaveLength(2);

    const original = await get(boxId);
    expect(original).toMatchObject({ status: "ready", shared: true, senderNote: "改成任何东西" });
    expect(original.receiverId).toBeUndefined();

    const codes = new Set([original.code]);
    for (const [i, receiverId] of [b, c].entries()) {
      const copy = await get(boxIds[i]);
      expect(copy).toMatchObject({
        senderId: a,
        receiverId,
        status: "ready",
        sharedFrom: boxId,
        senderNote: "改成任何东西",
        photoId: original.photoId,
        cutoutId: original.cutoutId,
        modelId: original.modelId,
      });
      codes.add(copy.code);
    }
    expect(codes.size).toBe(3);
    expect(await storage()).toBe(filesBefore);

    const bInbox = await t.query(api.boxes.inbox, { userId: b });
    expect(bInbox.received.find((box) => box._id === boxIds[0])?.action).toBe("claim");
    const copyCode = (await get(boxIds[0])).code;
    expect(await t.mutation(api.boxes.claim, { code: copyCode, userId: b })).toEqual({ boxId: boxIds[0] });
    expect((await get(boxIds[0])).status).toBe("claimed");
  });

  test("empty receiverIds marks the box shared, keeps the old note when none given", async () => {
    const { t, a, boxId, get, count } = await setup();
    expect(await t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [] })).toEqual({ boxIds: [] });
    expect(await get(boxId)).toMatchObject({ shared: true, senderNote: "原留言", status: "ready" });
    expect(await count()).toBe(1);
  });

  test("sharing again to the same friend returns the existing copy", async () => {
    const { t, a, b, c, boxId, count } = await setup();
    const first = await t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b] });
    const second = await t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b, c] });
    expect(second.boxIds[0]).toBe(first.boxIds[0]);
    expect(await count()).toBe(3);
  });

  test("invite code: each claimer gets their own claimed copy, repeat claim is idempotent", async () => {
    const { t, a, b, c, d, boxId, get, count } = await setup();
    const { boxIds } = await t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b] });

    const forC = await t.mutation(api.boxes.claim, { code: "111111", userId: c });
    const forD = await t.mutation(api.boxes.claim, { code: "111111", userId: d });
    expect(forC.boxId).not.toBe(boxId);
    expect(forD.boxId).not.toBe(forC.boxId);
    expect(await t.mutation(api.boxes.claim, { code: "111111", userId: c })).toEqual(forC);
    expect(await get(forC.boxId)).toMatchObject({ senderId: a, receiverId: c, status: "claimed", sharedFrom: boxId, senderNote: "原留言" });

    expect(await t.mutation(api.boxes.claim, { code: "111111", userId: b })).toEqual({ boxId: boxIds[0] });
    expect((await get(boxIds[0])).status).toBe("claimed");

    expect(await get(boxId)).toMatchObject({ status: "ready" });
    expect((await get(boxId)).receiverId).toBeUndefined();
    expect(await count()).toBe(4);
    expect(await errorCode(t.mutation(api.boxes.claim, { code: "111111", userId: a }))).toBe("INVALID_INPUT");

    const cInbox = await t.query(api.boxes.inbox, { userId: c });
    expect(cInbox.received.find((box) => box._id === forC.boxId)?.action).toBe("edit");
  });

  test("errors", async () => {
    const { t, a, b, d, boxId } = await setup();
    expect(await errorCode(t.mutation(api.boxes.share, { boxId, userId: b, receiverIds: [] }))).toBe("NOT_SENDER");
    expect(await errorCode(t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b, a] }))).toBe("INVALID_INPUT");
    await t.run((ctx) => ctx.db.delete(d));
    expect(await errorCode(t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b, d] }))).toBe("USER_NOT_FOUND");
    expect(await t.run(async (ctx) => (await ctx.db.query("boxes").collect()).length)).toBe(1);
  });

  test("preparing -> NOT_READY, claimed or opened -> WRONG_STATUS, copies cannot be re-shared", async () => {
    const preparing = await setup({ status: "preparing" });
    expect(await errorCode(preparing.t.mutation(api.boxes.share, { boxId: preparing.boxId, userId: preparing.a, receiverIds: [] }))).toBe("NOT_READY");

    const claimed = await setup({ status: "claimed" });
    await claimed.t.run((ctx) => ctx.db.patch(claimed.boxId, { receiverId: claimed.b }));
    expect(await errorCode(claimed.t.mutation(api.boxes.share, { boxId: claimed.boxId, userId: claimed.a, receiverIds: [] }))).toBe("WRONG_STATUS");

    const opened = await setup({ status: "opened" });
    expect(await errorCode(opened.t.mutation(api.boxes.share, { boxId: opened.boxId, userId: opened.a, receiverIds: [] }))).toBe("WRONG_STATUS");

    const s = await setup();
    const { boxIds } = await s.t.mutation(api.boxes.share, { boxId: s.boxId, userId: s.a, receiverIds: [s.b] });
    expect(await errorCode(s.t.mutation(api.boxes.share, { boxId: boxIds[0], userId: s.a, receiverIds: [s.c] }))).toBe("WRONG_STATUS");
  });

  test("BoxView carries sender/receiver colors and share markers", async () => {
    const { t, a, b, boxId } = await setup();
    const { boxIds } = await t.mutation(api.boxes.share, { boxId, userId: a, receiverIds: [b] });
    const copy = await t.query(api.boxes.get, { boxId: boxIds[0], viewerId: b });
    expect(copy).toMatchObject({ senderColor: "#f00", receiverColor: "#0f0", sharedFrom: boxId });
    const original = await t.query(api.boxes.get, { boxId, viewerId: a });
    expect(original.shared).toBe(true);
    expect(original).not.toHaveProperty("receiverColor");
  });
});

describe("users.friends", () => {
  test("other party of my boxes, deduped, most recent first, without unclaimed originals", async () => {
    const { t, a, b, c, d } = await setup();
    await t.run(async (ctx) => {
      const photoId = await ctx.storage.store(new Blob(["p"], { type: "image/jpeg" }));
      const box = (senderId: Id<"users">, receiverId: Id<"users"> | undefined, extra: Partial<Doc<"boxes">> = {}) =>
        ctx.db.insert("boxes", { code: String(Math.random()).slice(2, 8), senderId, receiverId, status: "claimed", photoId, ...extra });
      await box(a, b);
      await box(c, a);
      await box(a, undefined, { status: "ready" });
      await box(b, a, { status: "opened", openedAt: Date.now() + 60_000 });
      await box(b, c);
    });
    const friends = await t.query(api.users.friends, { userId: a });
    expect(friends).toEqual([
      { userId: b, nickname: "B", color: "#0f0" },
      { userId: c, nickname: "C", color: "#00f" },
    ]);
    expect(await t.query(api.users.friends, { userId: d })).toEqual([]);
  });

  test("unknown user -> USER_NOT_FOUND", async () => {
    const { t, d } = await setup();
    await t.run((ctx) => ctx.db.delete(d));
    expect(await errorCode(t.query(api.users.friends, { userId: d }))).toBe("USER_NOT_FOUND");
  });
});
