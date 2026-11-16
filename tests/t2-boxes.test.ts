/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.*s");

beforeEach(() => {
  process.env.MOCK_AI = "1";
});

const EDIT_FIELDS = [
  "snapshotUrl", "sceneShotUrl", "cameraPose", "prompt", "extraPhotoUrl",
  "editedImageUrl", "editedModelUrl", "receiverNote", "editError", "sealedAt", "openedAt",
];

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  throw new Error("expected a ConvexError");
}

function setup() {
  const t = convexTest(schema, modules);
  const users = () =>
    t.run(async (ctx) => ({
      a: await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 }),
      b: await ctx.db.insert("users", { nickname: "B", color: "#0f0", createdAt: 0 }),
    }));
  const upload = (type: string) => t.run((ctx) => ctx.storage.store(new Blob(["x"], { type })));
  const insertBox = (fields: Partial<Doc<"boxes">> & Pick<Doc<"boxes">, "senderId" | "status">) =>
    t.run(async (ctx) =>
      ctx.db.insert("boxes", {
        code: String(Math.floor(Math.random() * 1e6)).padStart(6, "0"),
        photoId: await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" })),
        ...fields,
      }),
    );
  return { t, users, upload, insertBox };
}

describe("boxes.create", () => {
  test("creates a preparing box and schedules prepare.run", async () => {
    const { t, users, upload } = setup();
    const { a } = await users();
    const photo = await upload("image/jpeg");
    const { boxId } = await t.mutation(api.boxes.create, { userId: a, photoStorageId: photo, senderNote: "给你" });

    const box = await t.run((ctx) => ctx.db.get(boxId));
    expect(box).toMatchObject({ status: "preparing", senderId: a, photoId: photo, senderNote: "给你" });
    expect(box!.code).toMatch(/^\d{6}$/);

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].name).toMatch(/^prepare(\.js)?:run$/);
    expect(scheduled[0].args).toEqual([{ boxId }]);
  });

  test("accepts PNG", async () => {
    const { t, users, upload } = setup();
    const { a } = await users();
    const { boxId } = await t.mutation(api.boxes.create, { userId: a, photoStorageId: await upload("image/png") });
    expect(boxId).toBeTruthy();
  });

  test("unknown user → USER_NOT_FOUND", async () => {
    const { t, users, upload } = setup();
    const { a } = await users();
    const photo = await upload("image/jpeg");
    await t.run((ctx) => ctx.db.delete(a));
    expect(await codeOf(t.mutation(api.boxes.create, { userId: a, photoStorageId: photo }))).toBe("USER_NOT_FOUND");
  });

  test("HEIC photo → INVALID_INPUT, nothing inserted", async () => {
    const { t, users, upload } = setup();
    const { a } = await users();
    const photo = await upload("image/heic");
    expect(await codeOf(t.mutation(api.boxes.create, { userId: a, photoStorageId: photo }))).toBe("INVALID_INPUT");
    expect(await t.run((ctx) => ctx.db.query("boxes").collect())).toHaveLength(0);
  });
});

describe("boxes.get", () => {
  test("missing box → BOX_NOT_FOUND", async () => {
    const { t, users, insertBox } = setup();
    const { a } = await users();
    const boxId = await insertBox({ senderId: a, status: "ready" });
    await t.run((ctx) => ctx.db.delete(boxId));
    expect(await codeOf(t.query(api.boxes.get, { boxId }))).toBe("BOX_NOT_FOUND");
  });

  test("A cannot see any of B's edit fields before opening", async () => {
    const { t, users, upload, insertBox } = setup();
    const { a, b } = await users();
    const png = () => upload("image/png");
    const edits = {
      snapshotId: await png(), sceneShotId: await png(), extraPhotoId: await png(),
      editedImageId: await png(), editedModelId: await upload("model/gltf-binary"),
      cameraPose: { position: [0, 1, 2], target: [0, 0, 0], fov: 50 },
      prompt: "戴帽子", receiverNote: "开吧", editError: "x", sealedAt: 1,
    };
    for (const status of ["claimed", "editing", "edited", "sealed"] as const) {
      const boxId = await insertBox({ senderId: a, receiverId: b, status, ...edits });
      const asA = await t.query(api.boxes.get, { boxId, viewerId: a });
      for (const key of EDIT_FIELDS) expect(asA, `${status}.${key}`).not.toHaveProperty(key);
      expect(asA.photoUrl).toMatch(/^https?:/);

      const asB = await t.query(api.boxes.get, { boxId, viewerId: b });
      expect(asB.prompt).toBe("戴帽子");
      expect(asB.editedImageUrl).toMatch(/^https?:/);
    }

    const opened = await insertBox({ senderId: a, receiverId: b, status: "opened", openedAt: 2, ...edits });
    const view = await t.query(api.boxes.get, { boxId: opened, viewerId: a });
    expect(view.receiverNote).toBe("开吧");
    expect(view.editedModelUrl).toMatch(/^https?:/);
  });
});

describe("boxes.inbox", () => {
  async function inboxFixture() {
    const s = setup();
    const { a, b } = await s.users();
    const ids: Record<string, Id<"boxes">> = {};
    for (const status of ["preparing", "ready", "claimed", "editing", "edited", "sealed", "opened"] as const) {
      ids[`ab_${status}`] = await s.insertBox({
        senderId: a,
        status,
        receiverId: status === "preparing" || status === "ready" ? undefined : b,
      });
    }
    ids.reply = await s.insertBox({ senderId: a, receiverId: b, status: "ready" });
    return { ...s, a, b, ids };
  }

  test("B: ready reply box → claim, claimed/editing/edited → edit, sealed (A not opened yet) → photo", async () => {
    const { t, b, ids } = await inboxFixture();
    const { received, sent } = await t.query(api.boxes.inbox, { userId: b });
    const actions = Object.fromEntries(received.map((r) => [r._id, r.action]));
    expect(actions).toEqual({
      [ids.reply]: "claim",
      [ids.ab_claimed]: "edit",
      [ids.ab_editing]: "edit",
      [ids.ab_edited]: "edit",
      [ids.ab_sealed]: "photo",
    });
    expect(sent).toEqual([]);
  });

  test("A: sealed box → open, appears in sent too, edits hidden", async () => {
    const { t, a, ids } = await inboxFixture();
    const { received, sent } = await t.query(api.boxes.inbox, { userId: a });
    expect(received.map((r) => [r._id, r.action])).toEqual([[ids.ab_sealed, "open"]]);
    expect(received[0]).not.toHaveProperty("receiverNote");
    expect(sent.map((s) => s._id)).toContain(ids.ab_sealed);
    expect(sent).toHaveLength(8);
    expect(sent.map((s) => s.status)).toContain("preparing");
  });

  test("newest first, at most 50 each", async () => {
    const { t, users, insertBox } = setup();
    const { a, b } = await users();
    for (let i = 0; i < 30; i++) await insertBox({ senderId: a, receiverId: b, status: "claimed" });
    for (let i = 0; i < 30; i++) await insertBox({ senderId: b, receiverId: a, status: "sealed" });
    for (let i = 0; i < 30; i++) await insertBox({ senderId: a, receiverId: b, status: "claimed" });
    const { received, sent } = await t.query(api.boxes.inbox, { userId: b });
    expect(received).toHaveLength(50);
    expect(sent).toHaveLength(30);
    const times = received.map((r) => r._creationTime);
    expect(times).toEqual([...times].sort((x, y) => y - x));
    expect(received.filter((r) => r.action === "open")).toHaveLength(20);
    expect(received.slice(0, 30).every((r) => r.action === "edit")).toBe(true);
  });

  test("unknown user → USER_NOT_FOUND", async () => {
    const { t, users } = setup();
    const { a } = await users();
    await t.run((ctx) => ctx.db.delete(a));
    expect(await codeOf(t.query(api.boxes.inbox, { userId: a }))).toBe("USER_NOT_FOUND");
  });
});
