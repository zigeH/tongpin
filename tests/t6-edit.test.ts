/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { FAKE_CUTOUT_PNG_BASE64 } from "../convex/lib/mock";

const modules = import.meta.glob("../convex/**/*.*s");
const realFetch = globalThis.fetch;
const POSE = { position: [0, 1, 3], target: [0, 0, 0], fov: 50 };

async function setup(fields: Partial<Doc<"boxes">> = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const b = await ctx.db.insert("users", { nickname: "B", color: "#0f0", createdAt: 0 });
    const file = (type: string) => ctx.storage.store(new Blob(["x"], { type }));
    const boxId = await ctx.db.insert("boxes", {
      code: "200001",
      senderId: a,
      receiverId: b,
      status: "claimed",
      photoId: await file("image/jpeg"),
      cutoutId: await file("image/png"),
      modelId: await file("model/gltf-binary"),
      ...fields,
    });
    return {
      a, b, boxId,
      png: await file("image/png"),
      png2: await file("image/png"),
      jpeg: await file("image/jpeg"),
      gif: await file("image/gif"),
    };
  });
  const box = () => t.run(async (ctx) => (await ctx.db.get(ids.boxId))!);
  const scheduled = () => t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const submit = (over: Record<string, unknown> = {}) =>
    t.mutation(api.boxes.submitEdit, {
      boxId: ids.boxId,
      userId: ids.b,
      snapshotStorageId: ids.png,
      cameraPose: POSE,
      prompt: "  给它戴上一顶圣诞帽 ",
      ...over,
    } as never);
  return { t, ...ids, box, scheduled, submit };
}

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  return undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("boxes.submitEdit", () => {
  test("claimed box moves to editing, stores B's inputs and schedules edit.run", async () => {
    const s = await setup();
    await s.submit({ sceneShotStorageId: s.jpeg, extraPhotoStorageId: s.png2 });
    const after = await s.box();
    expect(after.status).toBe("editing");
    expect(after.prompt).toBe("给它戴上一顶圣诞帽");
    expect(after.snapshotId).toBe(s.png);
    expect(after.sceneShotId).toBe(s.jpeg);
    expect(after.extraPhotoId).toBe(s.png2);
    expect(after.cameraPose).toEqual(POSE);
    const jobs = await s.scheduled();
    expect(jobs.map((j) => j.name)).toEqual(["edit:run"]);
    expect(jobs[0].args).toEqual([{ boxId: s.boxId }]);
  });

  test("edited box can be resubmitted and old results are cleared", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      await ctx.db.patch(s.boxId, { status: "edited", snapshotId: s.png2, editedImageId: s.png2, editedModelId: s.png2, extraPhotoId: s.jpeg });
    });
    await s.submit({ prompt: "变成冰雕" });
    const after = await s.box();
    expect(after.status).toBe("editing");
    expect(after.prompt).toBe("变成冰雕");
    expect(after.snapshotId).toBe(s.png);
    expect(after.editedImageId).toBeUndefined();
    expect(after.editedModelId).toBeUndefined();
    expect(after.extraPhotoId).toBeUndefined();
  });

  test("only the receiver can submit", async () => {
    const s = await setup();
    expect(await errorCode(s.submit({ userId: s.a }))).toBe("NOT_RECEIVER");
  });

  test("wrong status is rejected", async () => {
    for (const status of ["ready", "editing", "sealed"] as const) {
      const s = await setup({ status });
      expect(await errorCode(s.submit())).toBe("WRONG_STATUS");
    }
  });

  test("prompt must be 1–200 characters after trimming", async () => {
    const s = await setup();
    expect(await errorCode(s.submit({ prompt: "   " }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ prompt: "字".repeat(201) }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ prompt: "字".repeat(200) }))).toBeUndefined();
  });

  test("cameraPose position and target need exactly 3 numbers", async () => {
    const s = await setup();
    expect(await errorCode(s.submit({ cameraPose: { ...POSE, position: [0, 1] } }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ cameraPose: { ...POSE, target: [0, 0, 0, 0] } }))).toBe("INVALID_INPUT");
  });

  test("content types: snapshot PNG only, scene shot and photo JPEG or PNG", async () => {
    const s = await setup();
    expect(await errorCode(s.submit({ snapshotStorageId: s.jpeg }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ sceneShotStorageId: s.gif }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ extraPhotoStorageId: s.gif }))).toBe("INVALID_INPUT");
    expect((await s.box()).status).toBe("claimed");
    expect(await errorCode(s.submit({ sceneShotStorageId: s.jpeg, extraPhotoStorageId: s.jpeg }))).toBeUndefined();
  });
});

describe("edit.run (MOCK_AI=1)", () => {
  beforeEach(() => vi.stubEnv("MOCK_AI", "1"));

  test("uses the snapshot as the edited image and schedules kara.request edited", async () => {
    const fetchSpy = vi.fn(realFetch);
    vi.stubGlobal("fetch", fetchSpy);
    const s = await setup();
    await s.submit();
    await s.t.action(internal.edit.run, { boxId: s.boxId });
    const after = await s.box();
    expect(after.status).toBe("editing");
    expect(after.editedImageId).toBe(s.png);
    const jobs = await s.scheduled();
    expect(jobs.map((j) => j.name)).toEqual(["edit:run", "kara:request"]);
    expect(jobs[1].args).toEqual([{ boxId: s.boxId, kind: "edited" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("edit.run (real services, fetch stubbed)", () => {
  const png = Uint8Array.from(atob(FAKE_CUTOUT_PNG_BASE64), (c) => c.charCodeAt(0));

  function stubServices(openai: "ok" | "fail", fal: "ok" | "fail" = "ok") {
    const forms: FormData[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.openai.com/v1/images/edits") {
        forms.push(init!.body as FormData);
        if (openai === "fail") return new Response(JSON.stringify({ error: { message: "bad" } }), { status: 500 });
        return Response.json({ data: [{ b64_json: FAKE_CUTOUT_PNG_BASE64 }] });
      }
      if (url.startsWith("https://fal.run/")) {
        if (fal === "fail") return new Response("nope", { status: 401 });
        return Response.json({ image: { url: "https://fal.media/files/edited.png" } });
      }
      if (url === "https://fal.media/files/edited.png") return new Response(png);
      return realFetch(input, init);
    }));
    return forms;
  }

  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "");
    vi.stubEnv("FAL_KEY", "test-key");
  });

  test("calls OpenAI with snapshot and B's photo, re-cuts, stores editedImageId", async () => {
    const forms = stubServices("ok");
    const s = await setup();
    await s.submit({ extraPhotoStorageId: s.jpeg });
    await s.t.action(internal.edit.run, { boxId: s.boxId });

    expect(forms).toHaveLength(1);
    const form = forms[0];
    expect(form.get("model")).toBe("gpt-image-2.6-flare");
    expect(form.get("background")).toBe("transparent");
    expect(form.getAll("image[]")).toHaveLength(2);
    expect(String(form.get("prompt"))).toContain("给它戴上一顶圣诞帽");
    expect(String(form.get("prompt"))).toContain("second image");

    const after = await s.box();
    expect(after.status).toBe("editing");
    expect(after.editedImageId).toBeDefined();
    expect(after.editedImageId).not.toBe(s.png);
    const type = await s.t.run(async (ctx) => (await ctx.storage.get(after.editedImageId as Id<"_storage">))!.type);
    expect(type).toBe("image/png");
    expect((await s.scheduled()).map((j) => j.name)).toEqual(["edit:run", "kara:request"]);
  });

  test("OpenAI failure returns the box to claimed with editError, and B can retry", async () => {
    stubServices("fail");
    const s = await setup();
    await s.submit();
    await s.t.action(internal.edit.run, { boxId: s.boxId });
    const after = await s.box();
    expect(after.status).toBe("claimed");
    expect(after.editError).toMatch(/^改造失败：OpenAI 返回 500/);
    expect(after.editedImageId).toBeUndefined();

    await s.submit();
    const retried = await s.box();
    expect(retried.status).toBe("editing");
    expect(retried.editError).toBeUndefined();
  });

  test("background removal failure also fails the edit", async () => {
    stubServices("ok", "fail");
    const s = await setup();
    await s.submit();
    await s.t.action(internal.edit.run, { boxId: s.boxId });
    const after = await s.box();
    expect(after.status).toBe("claimed");
    expect(after.editError).toMatch(/^改造失败：fal 返回 401/);
  });
});
