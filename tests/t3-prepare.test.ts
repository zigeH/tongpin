/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { FAKE_CUTOUT_PNG_BASE64 } from "../convex/lib/mock";
import { toBoxView } from "../convex/lib/view";

const modules = import.meta.glob("../convex/**/*.*s");

const realFetch = globalThis.fetch;

async function setup(fields: Partial<Doc<"boxes">> = {}) {
  const t = convexTest(schema, modules);
  const { boxId, senderId } = await t.run(async (ctx) => {
    const senderId = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const photoId = await ctx.storage.store(new Blob(["jpeg"], { type: "image/jpeg" }));
    const boxId = await ctx.db.insert("boxes", {
      code: "100001",
      senderId,
      status: "preparing",
      photoId,
      ...fields,
    });
    return { boxId, senderId };
  });
  const box = () => t.run(async (ctx) => (await ctx.db.get(boxId))!);
  const scheduled = () => t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return { t, boxId, senderId, box, scheduled };
}

function falFetch(outcomes: ("ok" | "fail")[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const pngBytes = Uint8Array.from(atob(FAKE_CUTOUT_PNG_BASE64), (c) => c.charCodeAt(0));
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://fal.run/")) {
      calls.push({ url, init });
      if (outcomes[calls.length - 1] === "fail") {
        return new Response(JSON.stringify({ detail: "Invalid key" }), { status: 401 });
      }
      return Response.json({
        image: { url: "https://fal.media/files/cutout.png", content_type: "image/png", width: 32, height: 32 },
      });
    }
    if (url === "https://fal.media/files/cutout.png") return new Response(pngBytes);
    return realFetch(input, init);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

beforeEach(() => {
  vi.stubEnv("FAL_KEY", "test-key");
  vi.stubEnv("FAL_BG_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("prepare.run (MOCK_AI=1)", () => {
  beforeEach(() => vi.stubEnv("MOCK_AI", "1"));

  test("stores the fake cutout, exposes cutoutUrl, schedules kara.request original", async () => {
    const fetchSpy = vi.fn(realFetch);
    vi.stubGlobal("fetch", fetchSpy);
    const { t, boxId, senderId, box, scheduled } = await setup();

    await t.action(internal.prepare.run, { boxId });

    const after = await box();
    expect(after.status).toBe("preparing");
    expect(after.cutoutId).toBeDefined();
    expect(after.editError).toBeUndefined();
    const stored = await t.run(async (ctx) => {
      const blob = (await ctx.storage.get(after.cutoutId!))!;
      return { type: blob.type, size: blob.size };
    });
    expect(stored.type).toBe("image/png");
    const view = await t.run((ctx) => toBoxView(ctx, after, senderId));
    expect(view.cutoutUrl).toMatch(/^https?:\/\//);

    const jobs = await scheduled();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe("kara:request");
    expect(jobs[0].args).toEqual([{ boxId, kind: "original" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("prepare.run (real fal path, fetch stubbed)", () => {
  beforeEach(() => vi.stubEnv("MOCK_AI", ""));

  test("calls fal with image_url and stores the downloaded PNG", async () => {
    const calls = falFetch(["ok"]);
    const { t, boxId, box, scheduled } = await setup();

    await t.action(internal.prepare.run, { boxId });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://fal.run/fal-ai/birefnet");
    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Key test-key");
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.image_url).toMatch(/^https?:\/\//);
    expect(body.output_format).toBe("png");

    const after = await box();
    expect(after.cutoutId).toBeDefined();
    const stored = await t.run(async (ctx) => {
      const blob = (await ctx.storage.get(after.cutoutId!))!;
      return { type: blob.type, size: blob.size };
    });
    expect(stored.type).toBe("image/png");
    expect(stored.size).toBeGreaterThan(0);
    expect((await scheduled()).map((j) => j.name)).toEqual(["kara:request"]);
  });

  test("FAL_BG_MODEL overrides the model path", async () => {
    vi.stubEnv("FAL_BG_MODEL", "fal-ai/birefnet/v2");
    const calls = falFetch(["ok"]);
    const { t, boxId } = await setup();
    await t.action(internal.prepare.run, { boxId });
    expect(calls[0].url).toBe("https://fal.run/fal-ai/birefnet/v2");
  });

  test("first failure is retried once and then succeeds", async () => {
    const calls = falFetch(["fail", "ok"]);
    const { t, boxId, box } = await setup();
    await t.action(internal.prepare.run, { boxId });
    expect(calls).toHaveLength(2);
    const after = await box();
    expect(after.cutoutId).toBeDefined();
    expect(after.editError).toBeUndefined();
  });

  test("two failures (wrong FAL_KEY) write editError, stay preparing, schedule nothing", async () => {
    vi.stubEnv("FAL_KEY", "wrong-key");
    const calls = falFetch(["fail", "fail"]);
    const { t, boxId, senderId, box, scheduled } = await setup();

    await t.action(internal.prepare.run, { boxId });

    expect(calls).toHaveLength(2);
    const after = await box();
    expect(after.status).toBe("preparing");
    expect(after.cutoutId).toBeUndefined();
    expect(after.editError).toMatch(/^抠图失败：fal 返回 401/);
    expect(await scheduled()).toHaveLength(0);
    const view = await t.run((ctx) => toBoxView(ctx, after, senderId));
    expect(view.editError).toBe(after.editError);
  });

  test("missing FAL_KEY is reported as the failure reason", async () => {
    vi.stubEnv("FAL_KEY", "");
    falFetch([]);
    const { t, boxId, box } = await setup();
    await t.action(internal.prepare.run, { boxId });
    expect((await box()).editError).toBe("抠图失败：FAL_KEY 未配置");
  });
});

describe("prepare.setCutout", () => {
  test("rejects a box that is no longer preparing", async () => {
    const { t, boxId } = await setup({ status: "ready" });
    const cutoutId = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "image/png" })));
    await expect(t.mutation(internal.prepare.setCutout, { boxId, cutoutId })).rejects.toThrow(/WRONG_STATUS/);
  });
});
