/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { SAMPLE_GLB_URL } from "../convex/lib/mock";

const modules = import.meta.glob("../convex/**/*.*s");

const GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
const KARA_URL = "https://kara.example/model.glb";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.MOCK_AI = "1";
  delete process.env.MOCK_3D;
  delete process.env.KARA_TOKEN;
  delete process.env.KARA_WEBHOOK_URL;
  fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === SAMPLE_GLB_URL || url === KARA_URL) return new Response(GLB_BYTES);
    if (url === "https://kara.example/hook") return new Response("ok");
    return new Response("nope", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.MOCK_AI;
});

async function errorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    const data = (e as { data?: unknown }).data;
    if (typeof data === "string") return (JSON.parse(data) as { code: string }).code;
    if (data && typeof data === "object") return (data as { code: string }).code;
    throw e;
  }
  return undefined;
}

async function seedBox(t: ReturnType<typeof convexTest>, fields: Partial<Doc<"boxes">> = {}) {
  return t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const png = () => ctx.storage.store(new Blob(["x"], { type: "image/png" }));
    const boxId = await ctx.db.insert("boxes", {
      code: "000001",
      senderId: a,
      status: "preparing",
      photoId: await png(),
      cutoutId: await png(),
      editError: "上次失败",
      ...fields,
    });
    return { a, boxId };
  });
}

async function storeGlb(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) => ctx.storage.store(new Blob([GLB_BYTES], { type: "model/gltf-binary" })));
}

async function readModel(t: ReturnType<typeof convexTest>, id: Id<"_storage">) {
  return t.run(async (ctx) => {
    const meta = await ctx.db.system.get(id);
    const blob = await ctx.storage.get(id);
    return { contentType: meta?.contentType, bytes: Array.from(new Uint8Array(await blob!.arrayBuffer())) };
  });
}

describe("MOCK 下自动走到 ready", () => {
  test("kara.request → kara.fake 下载示例 GLB，状态 ready、modelUrl 可用", async () => {
    const t = convexTest(schema, modules);
    const { a, boxId } = await seedBox(t);
    await t.action(internal.kara.request, { boxId, kind: "original" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const box = (await t.run((ctx) => ctx.db.get(boxId)))!;
    expect(box.status).toBe("ready");
    expect(box.editError).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(SAMPLE_GLB_URL);
    const model = await readModel(t, box.modelId!);
    expect(model.contentType).toBe("model/gltf-binary");
    expect(model.bytes).toEqual(Array.from(GLB_BYTES));

    const view = await t.query(api.boxes.get, { boxId, viewerId: a });
    expect(view.modelUrl).toMatch(/^https?:/);
  });

  test("kara.fake 至少等 3 秒才写回", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    const run = t.action(internal.kara.fake, { boxId, kind: "original" });
    await vi.advanceTimersByTimeAsync(2900);
    expect((await t.run((ctx) => ctx.db.get(boxId)))!.status).toBe("preparing");
    await vi.advanceTimersByTimeAsync(200);
    await run;
    expect((await t.run((ctx) => ctx.db.get(boxId)))!.status).toBe("ready");
  });

  test("只开 MOCK_3D=1 也走 kara.fake", async () => {
    delete process.env.MOCK_AI;
    process.env.MOCK_3D = "1";
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    await t.action(internal.kara.request, { boxId, kind: "original" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(boxId)))!.status).toBe("ready");
  });

  test("edited：editing → edited，写 editedModelId", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t, { status: "editing", modelId: await storeGlb(t) });
    await t.run(async (ctx) =>
      ctx.db.patch(boxId, { editedImageId: await ctx.storage.store(new Blob(["e"], { type: "image/png" })) }),
    );
    await t.action(internal.kara.request, { boxId, kind: "edited" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const box = (await t.run((ctx) => ctx.db.get(boxId)))!;
    expect(box.status).toBe("edited");
    expect(box.editedModelId).toBeDefined();
  });
});

describe("attachModel 两种方式", () => {
  test("storageId 直接写回", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    const modelStorageId = await storeGlb(t);
    expect(await t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelStorageId })).toBeNull();
    const box = (await t.run((ctx) => ctx.db.get(boxId)))!;
    expect(box.status).toBe("ready");
    expect(box.modelId).toBe(modelStorageId);
    expect(box.editError).toBeUndefined();
  });

  test("url 调度 kara.download，存为 model/gltf-binary 再写回", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    await t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelUrl: KARA_URL });
    expect((await t.run((ctx) => ctx.db.get(boxId)))!.status).toBe("preparing");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const box = (await t.run((ctx) => ctx.db.get(boxId)))!;
    expect(box.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledWith(KARA_URL);
    const model = await readModel(t, box.modelId!);
    expect(model.contentType).toBe("model/gltf-binary");
    expect(model.bytes).toEqual(Array.from(GLB_BYTES));
  });

  test("edited 用 storageId", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t, { status: "editing", modelId: await storeGlb(t) });
    await t.run(async (ctx) =>
      ctx.db.patch(boxId, { editedImageId: await ctx.storage.store(new Blob(["e"], { type: "image/png" })) }),
    );
    const modelStorageId = await storeGlb(t);
    await t.mutation(api.boxes.attachModel, { boxId, kind: "edited", modelStorageId });
    const box = (await t.run((ctx) => ctx.db.get(boxId)))!;
    expect(box.status).toBe("edited");
    expect(box.editedModelId).toBe(modelStorageId);
  });
});

describe("attachModel 校验", () => {
  test("两个都传或都不传 → INVALID_INPUT", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    const modelStorageId = await storeGlb(t);
    expect(await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind: "original" }))).toBe("INVALID_INPUT");
    expect(
      await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelStorageId, modelUrl: KARA_URL })),
    ).toBe("INVALID_INPUT");
  });

  test("非 http(s) url → INVALID_INPUT", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    expect(
      await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelUrl: "file:///x.glb" })),
    ).toBe("INVALID_INPUT");
  });

  test("盒子不存在 → BOX_NOT_FOUND", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    const modelStorageId = await storeGlb(t);
    await t.run((ctx) => ctx.db.delete(boxId));
    expect(await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelStorageId }))).toBe(
      "BOX_NOT_FOUND",
    );
  });

  test.each([
    ["original 但状态 ready", { status: "ready" as const }, "original" as const],
    ["original 但没有 cutoutId", { cutoutId: undefined }, "original" as const],
    ["edited 但状态 claimed", { status: "claimed" as const }, "edited" as const],
    ["edited 但没有 editedImageId", { status: "editing" as const }, "edited" as const],
  ])("%s → WRONG_STATUS", async (_name, fields, kind) => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t, fields);
    const modelStorageId = await storeGlb(t);
    expect(await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind, modelStorageId }))).toBe("WRONG_STATUS");
    expect(await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind, modelUrl: KARA_URL }))).toBe(
      "WRONG_STATUS",
    );
  });

  test("url 下载期间状态变了：写回失败并删掉下载的文件", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    await t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelUrl: KARA_URL });
    await t.run((ctx) => ctx.db.patch(boxId, { status: "ready" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const box = (await t.run((ctx) => ctx.db.get(boxId)))!;
    expect(box.modelId).toBeUndefined();
    const glbs = await t.run(async (ctx) =>
      (await ctx.db.system.query("_storage").collect()).filter((f) => f.contentType === "model/gltf-binary"),
    );
    expect(glbs).toHaveLength(0);
  });

  test("设了 KARA_TOKEN 时校验 token", async () => {
    process.env.KARA_TOKEN = "secret";
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    const modelStorageId = await storeGlb(t);
    expect(await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelStorageId }))).toBe(
      "INVALID_INPUT",
    );
    expect(
      await errorCode(t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelStorageId, token: "x" })),
    ).toBe("INVALID_INPUT");
    await t.mutation(api.boxes.attachModel, { boxId, kind: "original", modelStorageId, token: "secret" });
    expect((await t.run((ctx) => ctx.db.get(boxId)))!.status).toBe("ready");
  });
});

describe("kara.request 非 MOCK", () => {
  beforeEach(() => {
    delete process.env.MOCK_AI;
  });

  test("设了 KARA_WEBHOOK_URL 时 POST { boxId, kind, imageUrl }", async () => {
    process.env.KARA_WEBHOOK_URL = "https://kara.example/hook";
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    await t.action(internal.kara.request, { boxId, kind: "original" });
    const call = fetchMock.mock.calls.find(([url]) => String(url) === "https://kara.example/hook")!;
    expect(call[1].method).toBe("POST");
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({ boxId, kind: "original" });
    expect(body.imageUrl).toMatch(/^https?:/);
  });

  test("什么都没配时什么都不做", async () => {
    const t = convexTest(schema, modules);
    const { boxId } = await seedBox(t);
    await t.action(internal.kara.request, { boxId, kind: "original" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await t.run((ctx) => ctx.db.get(boxId)))!.status).toBe("preparing");
  });
});

describe("kara.pending", () => {
  test("只返回等 3D 的盒子，带 kind 和 imageUrl", async () => {
    const t = convexTest(schema, modules);
    const { boxId: needOriginal } = await seedBox(t);
    const { boxId: needEdited } = await seedBox(t, { status: "editing" });
    await t.run(async (ctx) =>
      ctx.db.patch(needEdited, { editedImageId: await ctx.storage.store(new Blob(["e"], { type: "image/png" })) }),
    );
    await seedBox(t, { cutoutId: undefined });
    await seedBox(t, { modelId: await storeGlb(t) });
    await seedBox(t, { status: "editing" });
    await seedBox(t, { status: "ready" });

    const jobs = await t.query(api.kara.pending, {});
    expect(jobs.map(({ boxId, kind }) => ({ boxId, kind })).sort((x, y) => x.kind.localeCompare(y.kind))).toEqual([
      { boxId: needEdited, kind: "edited" },
      { boxId: needOriginal, kind: "original" },
    ]);
    for (const job of jobs) expect(job.imageUrl).toMatch(/^https?:/);
  });
});

