import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";

// 开盒合影：App 内相机 + 3D 叠加合成的照片，存回盒子。
// 谁能存：盒子的寄件人或收件人；盒子里要已经有 3D（原版或改后版）。
export const saveShot = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users"), imageStorageId: v.id("_storage") },
  handler: async (ctx, { boxId, userId, imageStorageId }) => {
    const box = await ctx.db.get(boxId);
    if (box === null) fail("BOX_NOT_FOUND");
    if (box.senderId !== userId && box.receiverId !== userId) fail("NOT_RECEIVER", "只有寄件人或收件人能存合影");
    if (box.modelId === undefined && box.editedModelId === undefined) fail("WRONG_STATUS", "盒子里还没有 3D");
    const file = await ctx.db.system.get(imageStorageId);
    if (file === null) fail("INVALID_INPUT", "合影文件不存在");
    if (!["image/jpeg", "image/png"].includes(file.contentType ?? "")) {
      fail("INVALID_INPUT", `合影只接受 image/jpeg / image/png，收到 ${file.contentType ?? "未知类型"}`);
    }
    const shotId = await ctx.db.insert("shots", { boxId, userId, imageId: imageStorageId, createdAt: Date.now() });
    return { shotId };
  },
});

// 这个盒子的所有合影，新的在前
export const shots = query({
  args: { boxId: v.id("boxes") },
  handler: async (ctx, { boxId }) => {
    const rows = await ctx.db.query("shots").withIndex("by_box", (q) => q.eq("boxId", boxId)).order("desc").collect();
    const out = [];
    for (const row of rows) {
      const url = await ctx.storage.getUrl(row.imageId);
      if (url === null) continue;
      const user = await ctx.db.get(row.userId);
      out.push({ _id: row._id, url, userId: row.userId, nickname: user?.nickname ?? "", createdAt: row.createdAt });
    }
    return out;
  },
});
