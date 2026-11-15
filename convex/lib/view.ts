import type { GenericDatabaseReader, StorageReader } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { BoxStatus } from "./status";

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

export type BoxView = {
  _id: Id<"boxes">;
  _creationTime: number;
  code: string;
  status: BoxStatus;
  senderId: Id<"users">;
  senderNickname: string;
  senderColor: string;
  receiverId?: Id<"users">;
  receiverNickname?: string;
  receiverColor?: string;
  replyTo?: Id<"boxes">;
  shared?: true;
  sharedFrom?: Id<"boxes">;
  senderNote?: string;
  photoUrl: string;
  cutoutUrl?: string;
  modelUrl?: string;
  modelUsdzUrl?: string; // iOS AR Quick Look
  // B 的改造，"A 查看且未开盒"时一律省略
  snapshotUrl?: string;
  sceneShotUrl?: string;
  cameraPose?: CameraPose;
  prompt?: string;
  extraPhotoUrl?: string;
  editedImageUrl?: string;
  editedModelUrl?: string;
  editedUsdzUrl?: string;
  receiverNote?: string;
  editError?: string;
  sealedAt?: number;
  openedAt?: number;
};

export type ViewCtx = { db: GenericDatabaseReader<DataModel>; storage: StorageReader };

export async function toBoxView(
  ctx: ViewCtx,
  box: Doc<"boxes">,
  viewerId?: Id<"users">,
): Promise<BoxView> {
  const url = async (id?: Id<"_storage">) =>
    id === undefined ? undefined : ((await ctx.storage.getUrl(id)) ?? undefined);
  const sender = await ctx.db.get(box.senderId);
  const receiver = box.receiverId === undefined ? null : await ctx.db.get(box.receiverId);

  const view: BoxView = {
    _id: box._id,
    _creationTime: box._creationTime,
    code: box.code,
    status: box.status,
    senderId: box.senderId,
    senderNickname: sender?.nickname ?? "",
    senderColor: sender?.color ?? "",
    receiverId: box.receiverId,
    receiverNickname: receiver?.nickname,
    receiverColor: receiver?.color,
    replyTo: box.replyTo,
    shared: box.shared ? true : undefined,
    sharedFrom: box.sharedFrom,
    senderNote: box.senderNote,
    photoUrl: (await url(box.photoId)) ?? "",
    cutoutUrl: await url(box.cutoutId),
    modelUrl: await url(box.modelId),
    modelUsdzUrl: await url(box.modelUsdzId),
  };

  const hideEdits = viewerId !== undefined && viewerId === box.senderId && box.status !== "opened";
  if (hideEdits) {
    if (box.status === "preparing") view.editError = box.editError;
  } else {
    Object.assign(view, {
      snapshotUrl: await url(box.snapshotId),
      sceneShotUrl: await url(box.sceneShotId),
      cameraPose: box.cameraPose as CameraPose | undefined,
      prompt: box.prompt,
      extraPhotoUrl: await url(box.extraPhotoId),
      editedImageUrl: await url(box.editedImageId),
      editedModelUrl: await url(box.editedModelId),
      editedUsdzUrl: await url(box.editedUsdzId),
      receiverNote: box.receiverNote,
      editError: box.editError,
      sealedAt: box.sealedAt,
      openedAt: box.openedAt,
    });
  }

  return Object.fromEntries(
    Object.entries(view).filter(([, value]) => value !== undefined),
  ) as BoxView;
}
