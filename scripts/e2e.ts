import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { FAKE_CUTOUT_PNG_BASE64 } from "../convex/lib/mock";
import type { BoxView } from "../convex/lib/view";

export const EDIT_FIELDS = [
  "snapshotUrl",
  "sceneShotUrl",
  "cameraPose",
  "prompt",
  "extraPhotoUrl",
  "editedImageUrl",
  "editedModelUrl",
  "receiverNote",
  "editError",
  "sealedAt",
  "openedAt",
] as const satisfies readonly (keyof BoxView)[];

export const OPENED_FIELDS = [
  "snapshotUrl",
  "sceneShotUrl",
  "cameraPose",
  "prompt",
  "extraPhotoUrl",
  "editedImageUrl",
  "editedModelUrl",
  "receiverNote",
  "sealedAt",
  "openedAt",
] as const satisfies readonly (keyof BoxView)[];

export type StepResult = { name: string; status: "pass" | "fail" | "skip"; detail?: string };

export type Step<C> = {
  name: string;
  needs?: (keyof C)[];
  run: (ctx: C) => Promise<void>;
};

export class CheckFailed extends Error {}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckFailed(message);
}

export function errorCode(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  if (typeof data === "object" && data !== null && typeof (data as { code?: unknown }).code === "string") {
    return (data as { code: string }).code;
  }
  return undefined;
}

export async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const got = errorCode(error);
    check(got === code, `应报 ${code}，实际报 ${got ?? describeError(error)}`);
    return;
  }
  throw new CheckFailed(`应报 ${code}，实际成功了`);
}

export function presentFields(view: object, fields: readonly string[]): string[] {
  return fields.filter((field) => (view as Record<string, unknown>)[field] !== undefined);
}

export function isGlb(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0, 4)) === "glTF";
}

function describeError(error: unknown): string {
  const code = errorCode(error);
  if (code !== undefined) return `${code}：${(error as { data: { message?: string } }).data.message ?? ""}`;
  if (error instanceof Error) return error.message.split("\n")[0];
  return String(error);
}

export async function runSteps<C extends object>(
  ctx: C,
  steps: Step<C>[],
  log: (line: string) => void = console.log,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const step of steps) {
    const missing = (step.needs ?? []).filter((key) => ctx[key] === undefined);
    if (missing.length > 0) {
      const detail = `缺少前置结果：${missing.join(", ")}`;
      results.push({ name: step.name, status: "skip", detail });
      log(`SKIP  ${step.name}（${detail}）`);
      continue;
    }
    const started = Date.now();
    try {
      await step.run(ctx);
      results.push({ name: step.name, status: "pass" });
      log(`PASS  ${step.name}（${((Date.now() - started) / 1000).toFixed(1)}s）`);
    } catch (error) {
      const detail = describeError(error);
      results.push({ name: step.name, status: "fail", detail });
      log(`FAIL  ${step.name}：${detail}`);
    }
  }
  return results;
}

type Ctx = {
  userA?: Id<"users">;
  userB?: Id<"users">;
  boxId?: Id<"boxes">;
  code?: string;
  claimed?: true;
  edited?: true;
  sealed?: true;
  opened?: true;
  replyBoxId?: Id<"boxes">;
  replyClaimed?: true;
};

const POLL_MS = 1000;

function envMs(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function loadImage(envName: string): Blob {
  const path = process.env[envName];
  if (!path) {
    return new Blob([Uint8Array.from(atob(FAKE_CUTOUT_PNG_BASE64), (c) => c.charCodeAt(0))], { type: "image/png" });
  }
  return new Blob([readFileSync(path)], { type: extname(path).toLowerCase() === ".png" ? "image/png" : "image/jpeg" });
}

export function storySteps(client: ConvexHttpClient): Step<Ctx>[] {
  const upload = async (envName: string): Promise<Id<"_storage">> => {
    const image = loadImage(envName);
    const uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
    const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": image.type }, body: image });
    check(res.ok, `上传失败：HTTP ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    check(storageId, "上传返回里没有 storageId");
    return storageId;
  };

  const waitFor = async (
    boxId: Id<"boxes">,
    viewerId: Id<"users">,
    target: BoxView["status"],
    timeoutMs: number,
    failedWhen: (view: BoxView) => boolean,
  ): Promise<BoxView> => {
    const deadline = Date.now() + timeoutMs;
    let view = await client.query(api.boxes.get, { boxId, viewerId });
    while (view.status !== target) {
      check(!failedWhen(view), `状态 ${view.status}，editError：${view.editError}`);
      check(Date.now() < deadline, `${timeoutMs / 1000} 秒内没到 ${target}，当前 ${view.status}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      view = await client.query(api.boxes.get, { boxId, viewerId });
    }
    return view;
  };

  return [
    {
      name: "1. 注册 A、B；A 上传照片并 boxes.create",
      run: async (ctx) => {
        const a = await client.mutation(api.users.register, { nickname: "E2E-A" });
        const b = await client.mutation(api.users.register, { nickname: "E2E-B" });
        check(a.userId !== b.userId, "A、B 的 userId 相同");
        Object.assign(ctx, { userA: a.userId, userB: b.userId });
        const photoStorageId = await upload("E2E_PHOTO");
        const { boxId } = await client.mutation(api.boxes.create, {
          userId: a.userId,
          photoStorageId,
          senderNote: "e2e：送你一样东西",
        });
        const view = await client.query(api.boxes.get, { boxId, viewerId: a.userId });
        check(view._id === boxId, "boxes.get 返回的 _id 和新建的 boxId 不一致");
        ctx.boxId = boxId;
      },
    },
    {
      name: "2. 轮询到 ready，拿到盒子码和 modelUrl，GLB 能下载",
      needs: ["boxId", "userA"],
      run: async (ctx) => {
        const view = await waitFor(ctx.boxId!, ctx.userA!, "ready", envMs("E2E_READY_TIMEOUT_MS", 60_000), (v) =>
          v.status === "preparing" ? v.editError !== undefined : v.status !== "ready",
        );
        check(/^\d{6}$/.test(view.code), `盒子码不是 6 位数字：${view.code}`);
        check(view.cutoutUrl, "ready 了但没有 cutoutUrl");
        check(view.modelUrl, "ready 了但没有 modelUrl");
        const res = await fetch(view.modelUrl);
        check(res.ok, `下载 GLB 失败：HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        check(isGlb(bytes), `modelUrl 下载到的不是 GLB（${bytes.length} 字节）`);
        ctx.code = view.code;
      },
    },
    {
      name: "3. B 用盒子码 claim，重复认领返回同一个 boxId",
      needs: ["boxId", "code", "userB"],
      run: async (ctx) => {
        const first = await client.mutation(api.boxes.claim, { code: ctx.code!, userId: ctx.userB! });
        check(first.boxId === ctx.boxId, `claim 返回 ${first.boxId}，应为 ${ctx.boxId}`);
        const second = await client.mutation(api.boxes.claim, { code: ctx.code!, userId: ctx.userB! });
        check(second.boxId === ctx.boxId, `重复 claim 返回 ${second.boxId}，应为 ${ctx.boxId}`);
        const view = await client.query(api.boxes.get, { boxId: ctx.boxId!, viewerId: ctx.userB! });
        check(view.status === "claimed", `认领后状态 ${view.status}，应为 claimed`);
        check(view.receiverId === ctx.userB, "认领后 receiverId 不是 B");
        ctx.claimed = true;
      },
    },
    {
      name: "4. B 上传定格图 submitEdit，轮询到 edited",
      needs: ["boxId", "userB", "claimed"],
      run: async (ctx) => {
        const snapshotStorageId = await upload("E2E_SNAPSHOT");
        const sceneShotStorageId = await upload("E2E_SCENE_SHOT");
        const extraPhotoStorageId = await upload("E2E_EXTRA_PHOTO");
        await client.mutation(api.boxes.submitEdit, {
          boxId: ctx.boxId!,
          userId: ctx.userB!,
          snapshotStorageId,
          sceneShotStorageId,
          extraPhotoStorageId,
          cameraPose: { position: [0, 1, 3], target: [0, 0, 0], fov: 50 },
          prompt: process.env.E2E_PROMPT ?? "给它戴一顶草帽",
        });
        const view = await waitFor(ctx.boxId!, ctx.userB!, "edited", envMs("E2E_EDIT_TIMEOUT_MS", 120_000), (v) =>
          v.status !== "editing",
        );
        check(view.editedImageUrl, "edited 了但没有 editedImageUrl");
        check(view.editedModelUrl, "edited 了但没有 editedModelUrl");
        ctx.edited = true;
      },
    },
    {
      name: "5. A 开盒前 boxes.get(viewerId = A) 看不到 B 的改造字段",
      needs: ["boxId", "userA", "edited"],
      run: async (ctx) => {
        const view = await client.query(api.boxes.get, { boxId: ctx.boxId!, viewerId: ctx.userA! });
        check(view.status === "edited", `状态 ${view.status}，应为 edited`);
        const leaked = presentFields(view, EDIT_FIELDS);
        check(leaked.length === 0, `A 看到了：${leaked.join(", ")}`);
      },
    },
    {
      name: "6. B seal；A 的 inbox 出现 action 为 open 的盒子",
      needs: ["boxId", "userA", "userB", "edited"],
      run: async (ctx) => {
        await client.mutation(api.boxes.seal, { boxId: ctx.boxId!, userId: ctx.userB!, receiverNote: "e2e：改好了，开吧" });
        const { received } = await client.query(api.boxes.inbox, { userId: ctx.userA! });
        const item = received.find((box) => box._id === ctx.boxId);
        check(item, "A 的 inbox.received 里没有这个盒子");
        check(item.action === "open", `action 为 ${item.action}，应为 open`);
        check(item.status === "sealed", `状态 ${item.status}，应为 sealed`);
        ctx.sealed = true;
      },
    },
    {
      name: "7. A open，能看到全部改造字段",
      needs: ["boxId", "userA", "sealed"],
      run: async (ctx) => {
        const opened = await client.mutation(api.boxes.open, { boxId: ctx.boxId!, userId: ctx.userA! });
        check(opened.status === "opened", `open 返回状态 ${opened.status}`);
        const missing = OPENED_FIELDS.filter((f) => !presentFields(opened, [f]).length);
        check(missing.length === 0, `open 返回缺少：${missing.join(", ")}`);
        const view = await client.query(api.boxes.get, { boxId: ctx.boxId!, viewerId: ctx.userA! });
        const missingInGet = OPENED_FIELDS.filter((f) => !presentFields(view, [f]).length);
        check(missingInGet.length === 0, `开盒后 boxes.get 缺少：${missingInGet.join(", ")}`);
        ctx.opened = true;
      },
    },
    {
      name: "8. A reply；B 的 inbox 出现 action 为 claim 的盒子，B 用新码认领成功",
      needs: ["boxId", "userA", "userB", "opened"],
      run: async (ctx) => {
        const { boxId: replyBoxId } = await client.mutation(api.boxes.reply, {
          boxId: ctx.boxId!,
          userId: ctx.userA!,
          senderNote: "e2e：回礼",
        });
        check(replyBoxId !== ctx.boxId, "reply 返回了旧盒子的 boxId");
        ctx.replyBoxId = replyBoxId;
        const view = await client.query(api.boxes.get, { boxId: replyBoxId, viewerId: ctx.userB! });
        check(view.status === "ready", `回礼盒子状态 ${view.status}，应为 ready`);
        check(view.replyTo === ctx.boxId, "回礼盒子的 replyTo 不是旧盒子");
        check(view.modelUrl, "回礼盒子没有 modelUrl");
        const { received } = await client.query(api.boxes.inbox, { userId: ctx.userB! });
        const item = received.find((box) => box._id === replyBoxId);
        check(item, "B 的 inbox.received 里没有回礼盒子");
        check(item.action === "claim", `action 为 ${item.action}，应为 claim`);
        const claimed = await client.mutation(api.boxes.claim, { code: view.code, userId: ctx.userB! });
        check(claimed.boxId === replyBoxId, `用新码认领返回 ${claimed.boxId}，应为 ${replyBoxId}`);
        ctx.replyClaimed = true;
      },
    },
    {
      name: "9a. 反向：A 认领自己的盒子报 INVALID_INPUT",
      needs: ["code", "userA"],
      run: (ctx) => expectCode(client.mutation(api.boxes.claim, { code: ctx.code!, userId: ctx.userA! }), "INVALID_INPUT"),
    },
    {
      name: "9b. 反向：edited 之前封箱报 WRONG_STATUS",
      needs: ["replyBoxId", "replyClaimed", "userB"],
      run: (ctx) =>
        expectCode(
          client.mutation(api.boxes.seal, { boxId: ctx.replyBoxId!, userId: ctx.userB!, receiverNote: "太早了" }),
          "WRONG_STATUS",
        ),
    },
    {
      name: "9c. 反向：B 去开盒报 NOT_SENDER",
      needs: ["boxId", "userB"],
      run: (ctx) => expectCode(client.mutation(api.boxes.open, { boxId: ctx.boxId!, userId: ctx.userB! }), "NOT_SENDER"),
    },
    {
      name: "9d. 反向：错误的盒子码报 BOX_NOT_FOUND",
      needs: ["userB"],
      run: (ctx) => expectCode(client.mutation(api.boxes.claim, { code: "e2e-no-such-code", userId: ctx.userB! }), "BOX_NOT_FOUND"),
    },
  ];
}

async function main(): Promise<void> {
  const url = process.env.CONVEX_URL;
  if (!url) {
    console.error("缺少 CONVEX_URL。本地匿名部署：CONVEX_URL=$(grep ^CONVEX_URL= .env.local | cut -d= -f2) npx tsx scripts/e2e.ts");
    process.exit(2);
  }
  console.log(`e2e → ${url}`);
  const results = await runSteps<Ctx>({}, storySteps(new ConvexHttpClient(url)));
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  console.log(`\n${passed} 通过，${failed} 失败，${skipped} 跳过（共 ${results.length} 步）`);
  process.exit(failed + skipped === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
