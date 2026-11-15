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
  users: defineTable({ nickname: v.string(), color: v.string(), createdAt: v.number() }),
  boxes: defineTable({
    code: v.string(),
    senderId: v.id("users"),
    receiverId: v.optional(v.id("users")),
    status: boxStatus,
    replyTo: v.optional(v.id("boxes")),
    senderNote: v.optional(v.string()),
    // 原版
    photoId: v.id("_storage"),
    cutoutId: v.optional(v.id("_storage")),
    modelId: v.optional(v.id("_storage")),
    // B 的改造
    snapshotId: v.optional(v.id("_storage")),
    sceneShotId: v.optional(v.id("_storage")),
    cameraPose: v.optional(cameraPose),
    prompt: v.optional(v.string()),
    extraPhotoId: v.optional(v.id("_storage")),
    editedImageId: v.optional(v.id("_storage")),
    editedModelId: v.optional(v.id("_storage")),
    editError: v.optional(v.string()),
    receiverNote: v.optional(v.string()),
    sealedAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_sender", ["senderId"])
    .index("by_receiver", ["receiverId"]),
  exports: defineTable({
    boxId: v.id("boxes"), videoId: v.id("_storage"), createdAt: v.number(),
  }).index("by_box", ["boxId"]),
});
