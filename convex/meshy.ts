import { internalAction, internalMutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { fail } from "./lib/errors";
import {
  CLEAN_REF,
  createTask,
  describeSubject,
  FALLBACK_COLORS,
  FALLBACK_SUBJECT,
  getTask,
  type MeshyResource,
  type MeshyTask,
  TEXTURE_PROMPT,
  toDataUrl,
  VIEW_ANGLES,
  VIEWS_BASE,
} from "./lib/meshy";
import { assertStatus, modelKind, type ModelKind } from "./lib/status";

export const POLL_MS = 10_000;
export const MAX_POLLS = 60;
const POLYCOUNT = 30_000;

const stageName = v.union(v.literal("cleanRef"), v.literal("views"), v.literal("model"), v.literal("retexture"));
type StageName = Infer<typeof stageName>;

const stepArgs = {
  boxId: v.id("boxes"),
  kind: modelKind,
  imageUrl: v.string(),
  subject: v.string(),
  colors: v.string(),
  stage: stageName,
  jobs: v.array(v.object({ key: v.string(), id: v.string() })),
  outputs: v.record(v.string(), v.string()),
  retried: v.boolean(),
  polls: v.number(),
};
const stepState = v.object(stepArgs);
type StepState = Infer<typeof stepState>;

const STAGES: Record<StageName, { resource: MeshyResource; keys: string[]; next: StageName | null }> = {
  cleanRef: { resource: "image-to-image", keys: ["ref"], next: "views" },
  views: { resource: "image-to-image", keys: ["front", "side", "back"], next: "model" },
  model: { resource: "multi-image-to-3d", keys: ["model"], next: "retexture" },
  retexture: { resource: "retexture", keys: ["glb"], next: null },
};

class TaskFailure extends Error {
  constructor(message: string, readonly keys: string[]) {
    super(message);
  }
}

async function taskBody(s: StepState, key: string): Promise<Record<string, unknown>> {
  const image = (prompt: string, ref: string) => ({ ai_model: "nano-banana-pro", prompt, reference_image_urls: [ref] });
  switch (key) {
    case "ref":
      return image(CLEAN_REF(s.subject), await toDataUrl(s.imageUrl));
    case "front":
    case "side":
    case "back":
      return image(VIEWS_BASE(s.subject) + VIEW_ANGLES[key], s.outputs.ref);
    case "model":
      return {
        image_urls: [s.outputs.front, s.outputs.side, s.outputs.back],
        ai_model: "latest",
        should_texture: true,
        enable_pbr: true,
        should_remesh: true,
        target_polycount: POLYCOUNT,
        texture_prompt: TEXTURE_PROMPT(s.colors),
      };
    default:
      return {
        input_task_id: s.outputs.model,
        // 实测：用正面三视图当贴图风格参考，比单独生成的 cozy 风格图更蓬、更有体积感
        image_style_url: s.outputs.front,
        enable_original_uv: true,
        enable_pbr: true,
      };
  }
}

function taskOutput(resource: MeshyResource, id: string, task: MeshyTask): string | undefined {
  if (resource === "image-to-image") return task.image_urls?.[0];
  if (resource === "multi-image-to-3d") return id;
  return task.model_urls?.glb;
}

async function finalFail(ctx: ActionCtx, boxId: Id<"boxes">, kind: ModelKind, reason: string) {
  if (kind === "original") {
    await ctx.runMutation(internal.meshy.failOriginal, { boxId, reason });
  } else {
    await ctx.runMutation(internal.edit.fail, { boxId, reason: `3D 生成失败：${reason}` });
  }
}

export const failOriginal = internalMutation({
  args: { boxId: v.id("boxes"), reason: v.string() },
  handler: async (ctx, { boxId, reason }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    assertStatus(box, "preparing");
    await ctx.db.patch(boxId, { editError: `3D 生成失败：${reason}` });
  },
});

export const start = internalAction({
  args: { boxId: v.id("boxes"), kind: modelKind },
  handler: async (ctx, { boxId, kind }): Promise<null> => {
    const imageUrl = await ctx.runQuery(internal.kara.imageUrlFor, { boxId, kind });
    if (imageUrl === null) {
      await finalFail(ctx, boxId, kind, `没有 ${kind} 的图片`);
      return null;
    }
    let described = { subject: FALLBACK_SUBJECT, colors: FALLBACK_COLORS };
    try {
      described = await describeSubject(await toDataUrl(imageUrl));
    } catch (e) {
      console.error(`读取图片失败，用通用描述：${e instanceof Error ? e.message : String(e)}`);
    }
    await ctx.scheduler.runAfter(0, internal.meshy.step, {
      boxId,
      kind,
      imageUrl,
      ...described,
      stage: "cleanRef",
      jobs: [],
      outputs: {},
      retried: false,
      polls: 0,
    });
    return null;
  },
});

export const step = internalAction({
  args: stepArgs,
  handler: async (ctx, s): Promise<null> => {
    const stage = STAGES[s.stage];
    let jobs = s.jobs;
    try {
      const missing = stage.keys.filter((key) => !jobs.some((job) => job.key === key));
      if (missing.length > 0) {
        const created = await Promise.allSettled(
          missing.map(async (key) => ({ key, id: await createTask(stage.resource, await taskBody(s, key)) })),
        );
        jobs = [...jobs, ...created.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))];
        const rejected = created.find((r) => r.status === "rejected");
        if (rejected) throw rejected.reason;
        await ctx.scheduler.runAfter(POLL_MS, internal.meshy.step, { ...s, jobs, polls: 0 });
        return null;
      }

      const tasks = await Promise.all(jobs.map((job) => getTask(stage.resource, job.id)));
      const failed = jobs.filter((_, i) => tasks[i].status === "FAILED" || tasks[i].status === "CANCELED");
      if (failed.length > 0) {
        const detail = tasks.find((t) => t.task_error?.message)?.task_error?.message ?? "";
        throw new TaskFailure(`${stage.resource} 任务失败 ${detail}`.trim(), failed.map((job) => job.key));
      }
      if (!tasks.every((t) => t.status === "SUCCEEDED")) {
        if (s.polls >= MAX_POLLS) {
          const pending = jobs.filter((_, i) => tasks[i].status !== "SUCCEEDED");
          throw new TaskFailure(`${stage.resource} 超时`, pending.map((job) => job.key));
        }
        await ctx.scheduler.runAfter(POLL_MS, internal.meshy.step, { ...s, jobs, polls: s.polls + 1 });
        return null;
      }

      const outputs = { ...s.outputs };
      jobs.forEach((job, i) => {
        const output = taskOutput(stage.resource, job.id, tasks[i]);
        if (output === undefined) throw new TaskFailure(`${stage.resource} 结果里没有链接`, [job.key]);
        outputs[job.key] = output;
      });
      if (stage.next === null) {
        const usdzUrl = tasks.find((t) => t.model_urls?.usdz)?.model_urls?.usdz;
        await ctx.runAction(internal.kara.download, { boxId: s.boxId, kind: s.kind, url: outputs.glb, ...(usdzUrl ? { usdzUrl } : {}) });
        return null;
      }
      await ctx.scheduler.runAfter(0, internal.meshy.step, {
        ...s,
        stage: stage.next,
        jobs: [],
        outputs,
        retried: false,
        polls: 0,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      if (s.retried) {
        await finalFail(ctx, s.boxId, s.kind, reason);
        return null;
      }
      console.warn(`Meshy ${s.stage} 失败，重试一次：${reason}`);
      const dropped = e instanceof TaskFailure ? e.keys : [];
      await ctx.scheduler.runAfter(POLL_MS, internal.meshy.step, {
        ...s,
        jobs: jobs.filter((job) => !dropped.includes(job.key)),
        retried: true,
        polls: dropped.length > 0 ? 0 : s.polls,
      });
    }
    return null;
  },
});
