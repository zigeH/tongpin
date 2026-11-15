/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { SAMPLE_GLB_URL } from "../convex/lib/mock";
import { FALLBACK_SUBJECT } from "../convex/lib/meshy";
import { POLL_MS } from "../convex/meshy";

const modules = import.meta.glob("../convex/**/*.*s");
const GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const SUBJECT = "round yellow duck plush with orange beak";

type Posted = { resource: string; id: string; body: Record<string, unknown> };

let posted: Posted[];
let statusFor: (resource: string, id: string) => string;
let openaiOk: boolean;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  delete process.env.MOCK_AI;
  delete process.env.MOCK_3D;
  delete process.env.KARA_WEBHOOK_URL;
  process.env.MESHY_API_KEY = "test-meshy-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
  posted = [];
  statusFor = () => "SUCCEEDED";
  openaiOk = true;
  fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://api.openai.com/v1/chat/completions") {
      if (!openaiOk) return new Response("boom", { status: 500 });
      const content = JSON.stringify({ subject: SUBJECT, colors: "yellow body, orange beak" });
      return Response.json({ choices: [{ message: { content } }] });
    }
    const meshy = url.match(/^https:\/\/api\.meshy\.ai\/openapi\/v1\/([a-z0-9-]+)(?:\/(.+))?$/);
    if (meshy) {
      const [, resource, id] = meshy;
      if (init?.method === "POST") {
        const newId = `${resource}-${posted.length + 1}`;
        posted.push({ resource, id: newId, body: JSON.parse(String(init.body)) });
        return Response.json({ result: newId });
      }
      return Response.json({
        status: statusFor(resource, id!),
        image_urls: [`https://assets.meshy.example/${id}.png`],
        model_urls: { glb: `https://assets.meshy.example/${id}.glb` },
        task_error: { message: "bad input" },
      });
    }
    if (url.endsWith(".glb")) return new Response(GLB_BYTES);
    return new Response(PNG_BYTES, { headers: { "Content-Type": "image/png" } });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.MOCK_AI;
  delete process.env.MESHY_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

async function setup(fields: Partial<Doc<"boxes">> = {}) {
  const t = convexTest(schema, modules);
  const boxId = await t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const png = () => ctx.storage.store(new Blob([PNG_BYTES], { type: "image/png" }));
    return ctx.db.insert("boxes", {
      code: "300001",
      senderId: a,
      status: "preparing",
      photoId: await png(),
      cutoutId: await png(),
      ...fields,
    });
  });
  const box = () => t.run(async (ctx) => (await ctx.db.get(boxId))!);
  const scheduled = () => t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const finish = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, boxId, box, scheduled, finish };
}

const meshyCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith("https://api.meshy.ai"));

describe("kara.request 分支选择", () => {
  test("MOCK_AI=1 时即使有 MESHY_API_KEY 也走 kara.fake", async () => {
    process.env.MOCK_AI = "1";
    const s = await setup();
    await s.t.action(internal.kara.request, { boxId: s.boxId, kind: "original" });
    expect((await s.scheduled()).map((f) => f.name)).toEqual(["kara:fake"]);
    await s.finish();
    expect((await s.box()).status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledWith(SAMPLE_GLB_URL);
    expect(meshyCalls()).toHaveLength(0);
  });

  test("有 MESHY_API_KEY 时调度 meshy.start，不通知 Kara", async () => {
    process.env.KARA_WEBHOOK_URL = "https://kara.example/hook";
    const s = await setup();
    await s.t.action(internal.kara.request, { boxId: s.boxId, kind: "original" });
    expect((await s.scheduled()).map((f) => f.name)).toEqual(["meshy:start"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("没有 MESHY_API_KEY 时保持 Kara 行为", async () => {
    delete process.env.MESHY_API_KEY;
    process.env.KARA_WEBHOOK_URL = "https://kara.example/hook";
    const s = await setup();
    await s.t.action(internal.kara.request, { boxId: s.boxId, kind: "original" });
    expect(await s.scheduled()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://kara.example/hook");
  });
});

describe("Meshy 流程", () => {
  test("original：参考图 → 4 张视图 → 多图 3D → 重新贴图 → download，状态 ready", async () => {
    const s = await setup({ editError: "上次失败" });
    await s.t.action(internal.kara.request, { boxId: s.boxId, kind: "original" });
    await s.finish();

    expect(posted.map((p) => p.resource)).toEqual([
      "image-to-image",
      "image-to-image",
      "image-to-image",
      "image-to-image",
      "multi-image-to-3d",
      "retexture",
    ]);
    const [ref, front, side, back, model, retexture] = posted;
    expect(ref.body.ai_model).toBe("nano-banana-pro");
    expect(String(ref.body.prompt)).toContain(SUBJECT);
    expect((ref.body.reference_image_urls as string[])[0]).toMatch(/^data:image\/png;base64,/);
    for (const view of [front, side, back]) {
      expect(view.body.reference_image_urls).toEqual([`https://assets.meshy.example/${ref.id}.png`]);
    }
    expect(model.body).toMatchObject({
      image_urls: [front, side, back].map((p) => `https://assets.meshy.example/${p.id}.png`),
      should_texture: true,
      enable_pbr: true,
      should_remesh: true,
      target_polycount: 30000,
    });
    expect(String(model.body.texture_prompt)).toContain("yellow body, orange beak");
    expect(retexture.body).toMatchObject({
      input_task_id: model.id,
      image_style_url: `https://assets.meshy.example/${front.id}.png`,
      enable_original_uv: true,
      enable_pbr: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(`https://assets.meshy.example/${retexture.id}.glb`);

    const box = await s.box();
    expect(box.status).toBe("ready");
    expect(box.editError).toBeUndefined();
    const bytes = await s.t.run(async (ctx) => Array.from(new Uint8Array(await (await ctx.storage.get(box.modelId!))!.arrayBuffer())));
    expect(bytes).toEqual(Array.from(GLB_BYTES));
  });

  test("任务未完成时约 10 秒后再轮询，polls 递增", async () => {
    statusFor = () => "IN_PROGRESS";
    const s = await setup();
    const state = {
      boxId: s.boxId,
      kind: "original" as const,
      imageUrl: "https://storage.example/cutout.png",
      subject: SUBJECT,
      colors: "yellow",
      stage: "model" as const,
      jobs: [{ key: "model", id: "multi-image-to-3d-9" }],
      outputs: {},
      retried: false,
      polls: 3,
    };
    const before = Date.now();
    await s.t.action(internal.meshy.step, state);
    const [next] = await s.scheduled();
    expect(next.name).toBe("meshy:step");
    expect(next.args[0]).toMatchObject({ stage: "model", polls: 4, jobs: state.jobs });
    expect(next.scheduledTime - before).toBeGreaterThanOrEqual(POLL_MS);
    expect(posted).toHaveLength(0);
    expect((await s.box()).status).toBe("preparing");
  });

  test("某个任务失败时只重新提交它一次，然后继续到 ready", async () => {
    const failedOnce = new Set<string>();
    statusFor = (resource, id) => {
      if (resource === "multi-image-to-3d" && failedOnce.size === 0) {
        failedOnce.add(id);
        return "FAILED";
      }
      return "SUCCEEDED";
    };
    const s = await setup();
    await s.t.action(internal.meshy.start, { boxId: s.boxId, kind: "original" });
    await s.finish();
    expect(posted.filter((p) => p.resource === "multi-image-to-3d")).toHaveLength(2);
    expect(posted.filter((p) => p.resource === "image-to-image")).toHaveLength(4);
    expect((await s.box()).status).toBe("ready");
  });

  test("主体描述失败时退回通用描述，流程不卡住", async () => {
    openaiOk = false;
    const s = await setup();
    await s.t.action(internal.meshy.start, { boxId: s.boxId, kind: "original" });
    await s.finish();
    expect(String(posted[0].body.prompt)).toContain(FALLBACK_SUBJECT);
    expect((await s.box()).status).toBe("ready");
  });

  test("original 重试后仍失败：写 editError，停在 preparing", async () => {
    statusFor = (resource) => (resource === "retexture" ? "FAILED" : "SUCCEEDED");
    const s = await setup();
    await s.t.action(internal.meshy.start, { boxId: s.boxId, kind: "original" });
    await s.finish();
    expect(posted.filter((p) => p.resource === "retexture")).toHaveLength(2);
    const box = await s.box();
    expect(box.status).toBe("preparing");
    expect(box.modelId).toBeUndefined();
    expect(box.editError).toBe("3D 生成失败：retexture 任务失败 bad input");
  });

  test("提交请求出错也重试一次，仍失败就写 editError", async () => {
    const real = fetchMock.getMockImplementation() as (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) =>
      String(input).startsWith("https://api.meshy.ai") && init?.method === "POST"
        ? new Response("no credits", { status: 402 })
        : real(input, init),
    );
    const s = await setup();
    await s.t.action(internal.meshy.start, { boxId: s.boxId, kind: "original" });
    await s.finish();
    expect(meshyCalls()).toHaveLength(2);
    expect((await s.box()).editError).toMatch(/^3D 生成失败：Meshy POST \/v1\/image-to-image 返回 402/);
  });

  test("edited 重试后仍失败：退回 claimed，写改造失败", async () => {
    statusFor = () => "FAILED";
    const s = await setup({ status: "editing" });
    await s.t.run(async (ctx) => {
      const editedImageId = await ctx.storage.store(new Blob([PNG_BYTES], { type: "image/png" }));
      await ctx.db.patch(s.boxId, { editedImageId });
    });
    await s.t.action(internal.kara.request, { boxId: s.boxId, kind: "edited" });
    await s.finish();
    const box = await s.box();
    expect(box.status).toBe("claimed");
    expect(box.editedModelId).toBeUndefined();
    expect(box.editError).toBe("改造失败：3D 生成失败：image-to-image 任务失败 bad input");
  });

  test("edited 成功：editing → edited，写 editedModelId", async () => {
    const s = await setup({ status: "editing" });
    await s.t.run(async (ctx) => {
      const editedImageId = await ctx.storage.store(new Blob([PNG_BYTES], { type: "image/png" }));
      await ctx.db.patch(s.boxId, { editedImageId });
    });
    await s.t.action(internal.kara.request, { boxId: s.boxId, kind: "edited" });
    await s.finish();
    const box = await s.box();
    expect(box.status).toBe("edited");
    expect(box.editedModelId).toBeDefined();
  });
});
