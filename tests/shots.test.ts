/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.*s");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);

async function setup(withModel = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
    const b = await ctx.db.insert("users", { nickname: "B", color: "#0f0", createdAt: 0 });
    const c = await ctx.db.insert("users", { nickname: "C", color: "#00f", createdAt: 0 });
    const photo = await ctx.storage.store(new Blob([JPEG], { type: "image/jpeg" }));
    const model = withModel ? await ctx.storage.store(new Blob([GLB], { type: "model/gltf-binary" })) : undefined;
    const boxId = await ctx.db.insert("boxes", {
      code: "500001", senderId: a, receiverId: b, status: withModel ? "opened" : "preparing", photoId: photo, modelId: model,
    });
    const shot = await ctx.storage.store(new Blob([JPEG], { type: "image/jpeg" }));
    const glbFile = await ctx.storage.store(new Blob([GLB], { type: "model/gltf-binary" }));
    return { a, b, c, boxId, shot, glbFile };
  });
  return { t, ...ids };
}

describe("开盒合影 boxes.saveShot / boxes.shots", () => {
  test("收件人和寄件人都能存，shots 新的在前、带昵称和 url", async () => {
    const s = await setup();
    await s.t.mutation(api.boxes.saveShot, { boxId: s.boxId, userId: s.b, imageStorageId: s.shot });
    await s.t.mutation(api.boxes.saveShot, { boxId: s.boxId, userId: s.a, imageStorageId: s.shot });
    const list = await s.t.query(api.boxes.shots, { boxId: s.boxId, viewerId: s.a });
    expect(list.map((x) => x.nickname)).toEqual(["A", "B"]);
    expect(list[0].url).toMatch(/^https?:\/\//);
  });

  test("改造者封箱后拍的合影：寄件人开盒前看不到，开盒后看得到；改造者一直看得到", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const edited = await ctx.storage.store(new Blob([GLB], { type: "model/gltf-binary" }));
      await ctx.db.patch(s.boxId, { status: "sealed", editedModelId: edited });
    });
    await s.t.mutation(api.boxes.saveShot, { boxId: s.boxId, userId: s.b, imageStorageId: s.shot });
    await s.t.mutation(api.boxes.saveShot, { boxId: s.boxId, userId: s.a, imageStorageId: s.shot });

    const beforeOpen = await s.t.query(api.boxes.shots, { boxId: s.boxId, viewerId: s.a });
    expect(beforeOpen.map((x) => x.nickname)).toEqual(["A"]);
    const remixerView = await s.t.query(api.boxes.shots, { boxId: s.boxId, viewerId: s.b });
    expect(remixerView.map((x) => x.nickname)).toEqual(["A", "B"]);

    await s.t.mutation(api.boxes.open, { boxId: s.boxId, userId: s.a });
    const afterOpen = await s.t.query(api.boxes.shots, { boxId: s.boxId, viewerId: s.a });
    expect(afterOpen.map((x) => x.nickname)).toEqual(["A", "B"]);
  });

  test("旁人不能存；没 3D 的盒子不能存；非图片不能存", async () => {
    const s = await setup();
    await expect(s.t.mutation(api.boxes.saveShot, { boxId: s.boxId, userId: s.c, imageStorageId: s.shot })).rejects.toThrow();
    await expect(s.t.mutation(api.boxes.saveShot, { boxId: s.boxId, userId: s.b, imageStorageId: s.glbFile })).rejects.toThrow(/image\/jpeg/);
    const s2 = await setup(false);
    await expect(s2.t.mutation(api.boxes.saveShot, { boxId: s2.boxId, userId: s2.b, imageStorageId: s2.shot })).rejects.toThrow(/还没有 3D/);
  });

  test("attach 带 usdz 时写进盒子，BoxView 返回 modelUsdzUrl", async () => {
    const t = convexTest(schema, modules);
    const { boxId, a, glb, usdz } = await t.run(async (ctx) => {
      const a = await ctx.db.insert("users", { nickname: "A", color: "#f00", createdAt: 0 });
      const photo = await ctx.storage.store(new Blob([JPEG], { type: "image/jpeg" }));
      const boxId = await ctx.db.insert("boxes", { code: "500002", senderId: a, status: "preparing", photoId: photo, cutoutId: photo });
      const glb = await ctx.storage.store(new Blob([GLB], { type: "model/gltf-binary" }));
      const usdz = await ctx.storage.store(new Blob([GLB], { type: "model/vnd.usdz+zip" }));
      return { boxId, a, glb, usdz };
    });
    await t.mutation(internal.kara.attach, { boxId, kind: "original", modelStorageId: glb, usdzStorageId: usdz });
    const view = await t.query(api.boxes.get, { boxId, viewerId: a });
    expect(view.status).toBe("ready");
    expect(view.modelUsdzUrl).toMatch(/^https?:\/\//);
  });
});
