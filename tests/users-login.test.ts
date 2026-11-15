/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.*s");

async function errorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  return undefined;
}

const userCount = (t: ReturnType<typeof convexTest>) => t.run(async (ctx) => (await ctx.db.query("users").collect()).length);

describe("users.login", () => {
  test("returns the existing user instead of creating one", async () => {
    const t = convexTest(schema, modules);
    const existing = await t.mutation(api.users.register, { nickname: "Momo" });
    expect(await t.mutation(api.users.login, { nickname: "  Momo " })).toEqual(existing);
    expect(await userCount(t)).toBe(1);
  });

  test("matches case-insensitively, exact match first, oldest wins", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => ({
      upperNew: await ctx.db.insert("users", { nickname: "KARA", color: "#f00", createdAt: 20 }),
      upperOld: await ctx.db.insert("users", { nickname: "Kara", color: "#0f0", createdAt: 10 }),
      exact: await ctx.db.insert("users", { nickname: "kAra", color: "#00f", createdAt: 30 }),
    }));
    expect((await t.mutation(api.users.login, { nickname: "kara" })).userId).toBe(ids.upperOld);
    expect((await t.mutation(api.users.login, { nickname: "kAra" })).userId).toBe(ids.exact);
    expect(await userCount(t)).toBe(3);
  });

  test("creates a new user when nobody has that name", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.login, { nickname: " Newbie " });
    expect(created.nickname).toBe("Newbie");
    expect(await t.mutation(api.users.login, { nickname: "newbie" })).toEqual(created);
    expect(await userCount(t)).toBe(1);
  });

  test("rejects empty or too-long nicknames", async () => {
    const t = convexTest(schema, modules);
    expect(await errorCode(t.mutation(api.users.login, { nickname: "   " }))).toBe("INVALID_INPUT");
    expect(await errorCode(t.mutation(api.users.login, { nickname: "x".repeat(21) }))).toBe("INVALID_INPUT");
  });
});

describe("users.seedDemoFriends", () => {
  test("is idempotent and reuses existing kara", async () => {
    const t = convexTest(schema, modules);
    const kara = await t.mutation(api.users.register, { nickname: "Kara" });
    const first = await t.mutation(internal.users.seedDemoFriends, {});
    const second = await t.mutation(internal.users.seedDemoFriends, {});
    expect(second).toEqual(first);
    expect(first.karaId).toBe(kara.userId);
    expect(await userCount(t)).toBe(2);
    expect(await t.run(async (ctx) => (await ctx.db.query("friendships").collect()).length)).toBe(1);
  });

  test("kara and vincent are friends, alongside box-derived friends", async () => {
    const t = convexTest(schema, modules);
    const { karaId, vincentId } = await t.mutation(internal.users.seedDemoFriends, {});
    const momo = await t.mutation(api.users.login, { nickname: "momo" });
    await t.run(async (ctx) => {
      const photoId = await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" }));
      await ctx.db.insert("boxes", { code: "222222", senderId: momo.userId, receiverId: karaId, status: "claimed", photoId });
    });

    const karaFriends = await t.query(api.users.friends, { userId: karaId });
    expect(karaFriends.map((f) => f.nickname)).toEqual(["momo", "vincent"]);
    const vincentFriends = await t.query(api.users.friends, { userId: vincentId });
    expect(vincentFriends).toEqual([{ userId: karaId, nickname: "kara", color: expect.any(String) }]);
    expect((await t.query(api.users.friends, { userId: momo.userId })).map((f) => f.userId)).toEqual([karaId]);

    expect((await t.mutation(api.users.login, { nickname: "Kara" })).userId).toBe(karaId);
    expect((await t.mutation(api.users.login, { nickname: "VINCENT" })).userId).toBe(vincentId);
  });

  test("an explicit friend who also exchanged boxes appears once", async () => {
    const t = convexTest(schema, modules);
    const { karaId, vincentId } = await t.mutation(internal.users.seedDemoFriends, {});
    await t.run(async (ctx) => {
      const photoId = await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" }));
      await ctx.db.insert("boxes", { code: "333333", senderId: vincentId, receiverId: karaId, status: "claimed", photoId });
    });
    expect((await t.query(api.users.friends, { userId: karaId })).map((f) => f.userId)).toEqual([vincentId]);
  });
});
