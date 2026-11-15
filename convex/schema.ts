import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const boxStatus = v.union(
  v.literal("preparing"), v.literal("ready"), v.literal("claimed"),
  v.literal("editing"), v.literal("edited"), v.literal("sealed"), v.literal("opened"),
);

export const cameraPose = v.object({
  position: v.array(v.number()), target: v.array(v.number()), fov: v.number(),
});

export default defineSchema({
  users: defineTable({ nickname: v.string(), color: v.string(), createdAt: v.number() }).index("by_nickname", ["nickname"]),
  friendships: defineTable({ userA: v.id("users"), userB: v.id("users"), createdAt: v.number() })
    .index("by_userA", ["userA"])
    .index("by_userB", ["userB"]),
  boxes: defineTable({
    code: v.string(),
    senderId: v.id("users"),
    receiverId: v.optional(v.id("users")),
    status: boxStatus,
    replyTo: v.optional(v.id("boxes")),
    // boxes.share 之后原盒子变成"分享母盒"：永远停在 ready，认领它的码会给认领人另建一个副本
    shared: v.optional(v.boolean()),
    sharedFrom: v.optional(v.id("boxes")),
    senderNote: v.optional(v.string()),
    // 原版
    photoId: v.id("_storage"),
    cutoutId: v.optional(v.id("_storage")),
    modelId: v.optional(v.id("_storage")),
    // iOS AR Quick Look 用的 usdz（Meshy 一起导出；没有时为空）
    modelUsdzId: v.optional(v.id("_storage")),
    // B 的改造
    snapshotId: v.optional(v.id("_storage")),
    sceneShotId: v.optional(v.id("_storage")),
    cameraPose: v.optional(cameraPose),
    prompt: v.optional(v.string()),
    extraPhotoId: v.optional(v.id("_storage")),
    editedImageId: v.optional(v.id("_storage")),
    editedModelId: v.optional(v.id("_storage")),
    editedUsdzId: v.optional(v.id("_storage")),
    editError: v.optional(v.string()),
    receiverNote: v.optional(v.string()),
    sealedAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_sender", ["senderId"])
    .index("by_receiver", ["receiverId"]),
  // 开盒后和 3D 的合影（App 内相机 + 3D 叠加合成的 JPEG）
  shots: defineTable({
    boxId: v.id("boxes"), userId: v.id("users"), imageId: v.id("_storage"), createdAt: v.number(),
  }).index("by_box", ["boxId"]),
  exports: defineTable({
    boxId: v.id("boxes"), videoId: v.id("_storage"), createdAt: v.number(),
  }).index("by_box", ["boxId"]),
});
