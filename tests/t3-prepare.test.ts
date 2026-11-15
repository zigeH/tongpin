/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { CUTOUT_PROMPT } from "../convex/lib/cutout";
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

function openaiFetch(outcomes: ("ok" | "fail")[]) {
  const forms: FormData[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://api.openai.com/v1/images/edits") {
      forms.push(init!.body as FormData);
      if (outcomes[forms.length - 1] === "fail") {
        return new Response(JSON.stringify({ error: { message: "Incorrect API key provided" } }), { status: 401 });
      }
      return Response.json({ data: [{ b64_json: FAKE_CUTOUT_PNG_BASE64 }] });
    }
    if (url.startsWith("https://some-deployment.convex.cloud/api/storage/")) {
      return new Response("jpeg", { headers: { "Content-Type": "image/jpeg" } });
    }
    return realFetch(input, init);
  });
  vi.stubGlobal("fetch", fn);
  return forms;
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("OPENAI_IMAGE_MODEL", "");
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

describe("prepare.run (real OpenAI path, fetch stubbed)", () => {
  beforeEach(() => vi.stubEnv("MOCK_AI", ""));

  test("sends the photo to OpenAI images/edits with a transparent-background request and stores the PNG", async () => {
    const forms = openaiFetch(["ok"]);
    const { t, boxId, box, scheduled } = await setup();

    await t.action(internal.prepare.run, { boxId });

    expect(forms).toHaveLength(1);
    const form = forms[0];
    expect(form.get("model")).toBe("gpt-image-2.6-flare");
    expect(form.get("background")).toBe("transparent");
    expect(form.get("output_format")).toBe("png");
    expect(form.has("input_fidelity")).toBe(false);
    expect(String(form.get("prompt"))).toBe(CUTOUT_PROMPT);
    const images = form.getAll("image[]") as File[];
    expect(images).toHaveLength(1);
    expect(images[0].type).toBe("image/jpeg");
    expect(images[0].name).toBe("photo.jpg");

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

  test("OPENAI_IMAGE_MODEL overrides the model", async () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2.6-sunburst");
    const forms = openaiFetch(["ok"]);
    const { t, boxId } = await setup();
    await t.action(internal.prepare.run, { boxId });
    expect(forms[0].get("model")).toBe("gpt-image-2.6-sunburst");
  });

  test("first failure is retried once and then succeeds", async () => {
    const forms = openaiFetch(["fail", "ok"]);
    const { t, boxId, box } = await setup();
    await t.action(internal.prepare.run, { boxId });
    expect(forms).toHaveLength(2);
    const after = await box();
    expect(after.cutoutId).toBeDefined();
    expect(after.editError).toBeUndefined();
  });

  test("two failures (wrong OPENAI_API_KEY) write editError, stay preparing, schedule nothing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-wrong");
    const forms = openaiFetch(["fail", "fail"]);
    const { t, boxId, senderId, box, scheduled } = await setup();

    await t.action(internal.prepare.run, { boxId });

    expect(forms).toHaveLength(2);
    const after = await box();
    expect(after.status).toBe("preparing");
    expect(after.cutoutId).toBeUndefined();
    expect(after.editError).toMatch(/^抠图失败：OpenAI 返回 401/);
    expect(await scheduled()).toHaveLength(0);
    const view = await t.run((ctx) => toBoxView(ctx, after, senderId));
    expect(view.editError).toBe(after.editError);
  });

  test("missing OPENAI_API_KEY is reported as the failure reason", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    openaiFetch([]);
    const { t, boxId, box } = await setup();
    await t.action(internal.prepare.run, { boxId });
    expect((await box()).editError).toBe("抠图失败：OPENAI_API_KEY 未配置");
  });
});

describe("prepare.setCutout", () => {
  test("rejects a box that is no longer preparing", async () => {
    const { t, boxId } = await setup({ status: "ready" });
    const cutoutId = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "image/png" })));
    await expect(t.mutation(internal.prepare.setCutout, { boxId, cutoutId })).rejects.toThrow(/WRONG_STATUS/);
  });
});
