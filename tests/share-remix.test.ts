/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { buildEditPrompt, remixRequest } from "../convex/edit";
import { FAKE_CUTOUT_PNG_BASE64, SAMPLE_GLB_URL } from "../convex/lib/mock";

const modules = import.meta.glob("../convex/**/*.*s");
const realFetch = globalThis.fetch;
const POSE = { position: [0, 1, 3], target: [0, 0, 0], fov: 40 };
const GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "kk", color: "#f00", createdAt: 0 });
    const b = await ctx.db.insert("users", { nickname: "Mia", color: "#0f0", createdAt: 0 });
    const file = (type: string) => ctx.storage.store(new Blob(["x"], { type }));
    const boxId = await ctx.db.insert("boxes", {
      code: "300001",
      senderId: a,
      receiverId: b,
      status: "claimed",
      photoId: await file("image/jpeg"),
      cutoutId: await file("image/png"),
      modelId: await file("model/gltf-binary"),
    });
    return { a, b, boxId, shot: await file("image/png") };
  });
  const box = () => t.run(async (ctx) => (await ctx.db.get(ids.boxId))!);
  const submit = (over: Record<string, unknown> = {}) =>
    t.mutation(api.boxes.submitEdit, {
      boxId: ids.boxId,
      userId: ids.b,
      snapshotStorageId: ids.shot,
      cameraPose: POSE,
      prompt: "turn it into a throne",
      ...over,
    } as never);
  return { t, ...ids, box, submit };
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

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("submitEdit with props and seal", () => {
  test("stores the captured screenshot, the props and the auto-seal flag", async () => {
    const s = await setup();
    await s.submit({ props: [" gold crown ", "sunglasses"], seal: true });
    const after = await s.box();
    expect(after.status).toBe("editing");
    expect(after.snapshotId).toBe(s.shot);
    expect(after.props).toEqual(["gold crown", "sunglasses"]);
    expect(after.autoSeal).toBe(true);
  });

  test("an empty sentence is fine when props are stuck on, not otherwise", async () => {
    const s = await setup();
    expect(await errorCode(s.submit({ prompt: "  " }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ prompt: "", props: [] }))).toBe("INVALID_INPUT");
    await s.submit({ prompt: "", props: ["party hat"] });
    expect((await s.box()).prompt).toBe("");
  });

  test("rejects too many or blank props", async () => {
    const s = await setup();
    expect(await errorCode(s.submit({ props: Array.from({ length: 9 }, (_, i) => `p${i}`) }))).toBe("INVALID_INPUT");
    expect(await errorCode(s.submit({ props: [" "] }))).toBe("INVALID_INPUT");
    expect((await s.box()).status).toBe("claimed");
  });

  test("a resubmit without seal clears the earlier auto-seal and props", async () => {
    const s = await setup();
    await s.submit({ props: ["crown"], seal: true });
    await s.t.run((ctx) => ctx.db.patch(s.boxId, { status: "claimed" }));
    await s.submit();
    const after = await s.box();
    expect(after.autoSeal).toBeUndefined();
    expect(after.props).toBeUndefined();
  });

  test("the receiver sees props and autoSeal in boxes.get, the sender does not before opening", async () => {
    const s = await setup();
    await s.submit({ props: ["crown"], seal: true });
    const mine = await s.t.query(api.boxes.get, { boxId: s.boxId, viewerId: s.b });
    expect(mine.props).toEqual(["crown"]);
    expect(mine.autoSeal).toBe(true);
    const theirs = await s.t.query(api.boxes.get, { boxId: s.boxId, viewerId: s.a });
    expect(theirs.props).toBeUndefined();
    expect(theirs.autoSeal).toBeUndefined();
  });
});

describe("remix prompt from the screenshot", () => {
  test("remixRequest joins the sentence and the stuck-on props", () => {
    expect(remixRequest("make it gold")).toBe("make it gold");
    expect(remixRequest("make it gold", ["crown"])).toBe("make it gold; add the crown stuck on it in the picture");
    expect(remixRequest("  ", ["crown", "bow"])).toBe("add the crown, bow stuck on it in the picture");
  });

  test("buildEditPrompt tells the editor to turn the drawn props into real parts only when there are props", () => {
    expect(buildEditPrompt("x", false)).not.toContain("sticker-like props");
    const withProps = buildEditPrompt("x", false, undefined, ["crown"]);
    expect(withProps).toContain("sticker-like props drawn over it (crown)");
    expect(withProps).toContain("physically attached part");
  });

  test("edit.run sends the captured screenshot to the image edit and the props to the director", async () => {
    vi.stubEnv("MOCK_AI", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("EDIT_FAL_CUTOUT", "");
    const png = Uint8Array.from(atob(FAKE_CUTOUT_PNG_BASE64), (c) => c.charCodeAt(0));
    const directorBodies: string[] = [];
    const forms: FormData[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.openai.com/v1/chat/completions") {
        directorBodies.push(String(init!.body));
        return Response.json({ choices: [{ message: { content: JSON.stringify({ direction: "DIRECTED", notes: "" }) } }] });
      }
      if (url === "https://api.openai.com/v1/images/edits") {
        forms.push(init!.body as FormData);
        return Response.json({ data: [{ b64_json: FAKE_CUTOUT_PNG_BASE64 }] });
      }
      if (url.startsWith("https://some-deployment.convex.cloud/api/storage/")) return new Response(png, { headers: { "Content-Type": "image/png" } });
      return realFetch(input, init);
    }));
    const s = await setup();
    await s.t.run(async (ctx) => {
      const shot = await ctx.storage.store(new Blob(["SCREENSHOT"], { type: "image/png" }));
      await ctx.db.patch(s.boxId, { snapshotId: shot });
    });
    await s.submit({ prompt: "", props: ["gold crown"], seal: true, snapshotStorageId: (await s.box()).snapshotId });
    await s.t.action(internal.edit.run, { boxId: s.boxId });

    expect(directorBodies[0]).toContain("add the gold crown stuck on it in the picture");
    expect(forms).toHaveLength(1);
    const prompt = String(forms[0].get("prompt"));
    expect(prompt).toContain("sticker-like props drawn over it (gold crown)");
    expect(prompt).toContain("DIRECTED");
    const images = forms[0].getAll("image[]") as Blob[];
    expect(images).toHaveLength(1);
    expect(await images[0].text()).toBe("SCREENSHOT");
    expect((await s.box()).editedImageId).toBeDefined();
  });
});

describe("Remix it and seal the box (MOCK pipeline)", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "1");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      String(input) === SAMPLE_GLB_URL ? new Response(GLB_BYTES) : new Response("nope", { status: 404 }),
    ));
  });

  test("seal: true goes editing → sealed once the remixed 3D lands, and the sender gets an open action", async () => {
    const s = await setup();
    await s.submit({ props: ["crown"], seal: true });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await s.box();
    expect(after.status).toBe("sealed");
    expect(after.editedModelId).toBeDefined();
    expect(after.sealedAt).toBeTypeOf("number");
    expect(after.receiverNote).toBe("");
    const inbox = await s.t.query(api.boxes.inbox, { userId: s.a });
    expect(inbox.received.map((b) => [b._id, b.action])).toEqual([[s.boxId, "open"]]);
    await s.t.mutation(api.boxes.open, { boxId: s.boxId, userId: s.a });
    expect((await s.box()).status).toBe("opened");
  });

  test("without seal the box stops at edited as before", async () => {
    const s = await setup();
    await s.submit();
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await s.box()).status).toBe("edited");
  });
});

describe("share copy straight to remix", () => {
  test("a friend's share copy is claimed by its own code and becomes editable", async () => {
    const t = convexTest(schema, modules);
    const { a, b, copyId } = await t.run(async (ctx) => {
      const a = await ctx.db.insert("users", { nickname: "kk", color: "#f00", createdAt: 0 });
      const b = await ctx.db.insert("users", { nickname: "Mia", color: "#0f0", createdAt: 0 });
      const file = (type: string) => ctx.storage.store(new Blob(["x"], { type }));
      const photoId = await file("image/jpeg");
      const modelId = await file("model/gltf-binary");
      const motherId = await ctx.db.insert("boxes", { code: "400001", senderId: a, status: "ready", shared: true, photoId, modelId });
      const copyId = await ctx.db.insert("boxes", { code: "400002", senderId: a, receiverId: b, status: "ready", sharedFrom: motherId, photoId, modelId });
      return { a, b, copyId };
    });
    const inbox = await t.query(api.boxes.inbox, { userId: b });
    expect(inbox.received.map((x) => x.action)).toEqual(["claim"]);
    expect(await t.mutation(api.boxes.claim, { code: "400002", userId: b })).toEqual({ boxId: copyId });
    const after = await t.query(api.boxes.inbox, { userId: b });
    expect(after.received.map((x) => [x._id, x.action, x.senderId])).toEqual([[copyId, "edit", a]]);
  });
});
