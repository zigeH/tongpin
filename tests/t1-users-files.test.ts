/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { USER_COLORS } from "../convex/users";

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

describe("users.register", () => {
  test("creates a user with trimmed nickname and a palette color", async () => {
    const t = convexTest(schema, modules);
    const before = Date.now();
    const res = await t.mutation(api.users.register, { nickname: "  小明  " });
    expect(res.nickname).toBe("小明");
    expect(USER_COLORS).toContain(res.color);
    const doc = await t.run((ctx) => ctx.db.get(res.userId));
    expect(doc).toMatchObject({ nickname: "小明", color: res.color });
    expect(doc!.createdAt).toBeGreaterThanOrEqual(before);
    expect(doc!.createdAt).toBeLessThanOrEqual(Date.now());
  });

  test("palette has 8 colors", () => {
    expect(new Set(USER_COLORS).size).toBe(8);
  });

  test.each(["", "   ", "\t\n"])("empty nickname %j -> INVALID_INPUT", async (nickname) => {
    const t = convexTest(schema, modules);
    expect(await errorCode(t.mutation(api.users.register, { nickname }))).toBe("INVALID_INPUT");
  });

  test("21 chars -> INVALID_INPUT, 20 chars ok", async () => {
    const t = convexTest(schema, modules);
    expect(await errorCode(t.mutation(api.users.register, { nickname: "a".repeat(21) }))).toBe("INVALID_INPUT");
    const ok = await t.mutation(api.users.register, { nickname: ` ${"字".repeat(20)} ` });
    expect(ok.nickname).toBe("字".repeat(20));
  });
});

describe("files.generateUploadUrl", () => {
  test("returns an upload url", async () => {
    const t = convexTest(schema, modules);
    const url = await t.mutation(api.files.generateUploadUrl, {});
    expect(url).toMatch(/^https?:\/\//);
  });
});
