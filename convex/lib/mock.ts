import type { Id } from "../_generated/dataModel";
import type { BoxView } from "./view";

export function isMock(): boolean {
  return process.env.MOCK_AI === "1";
}

export function isMock3D(): boolean {
  return isMock() || process.env.MOCK_3D === "1";
}

export const FAKE_CUTOUT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAXElEQVR42u2WQQ4AIAjD+H/8M37Ag8CURdfEc3uSmQmRwIf56rVIr8RE5dCIrBwSUZWXIlDyVARaHo74O+CUfDtCAQpoD9A/QBHQfowozjHFIKGYZBSjlGKWi2eZvBtxvaIyl0AAAAAASUVORK5CYII=";

export function fakeCutoutBlob(): Blob {
  const bytes = Uint8Array.from(atob(FAKE_CUTOUT_PNG_BASE64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

export const FAKE_IMAGE_DATA_URL = `data:image/png;base64,${FAKE_CUTOUT_PNG_BASE64}`;

export const SAMPLE_GLB_URL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb";

export const FAKE_USER_ID = "fake_user_a" as Id<"users">;
export const FAKE_RECEIVER_ID = "fake_user_b" as Id<"users">;
export const FAKE_BOX_ID = "fake_box" as Id<"boxes">;

export const FAKE_BOX_VIEW: BoxView = {
  _id: FAKE_BOX_ID,
  _creationTime: 1763200000000,
  code: "123456",
  status: "opened",
  senderId: FAKE_USER_ID,
  senderNickname: "演示A",
  receiverId: FAKE_RECEIVER_ID,
  receiverNickname: "演示B",
  senderNote: "送你一只鸭子",
  photoUrl: FAKE_IMAGE_DATA_URL,
  cutoutUrl: FAKE_IMAGE_DATA_URL,
  modelUrl: SAMPLE_GLB_URL,
  snapshotUrl: FAKE_IMAGE_DATA_URL,
  sceneShotUrl: FAKE_IMAGE_DATA_URL,
  cameraPose: { position: [0, 1, 3], target: [0, 0, 0], fov: 50 },
  prompt: "给它戴一顶草帽",
  extraPhotoUrl: FAKE_IMAGE_DATA_URL,
  editedImageUrl: FAKE_IMAGE_DATA_URL,
  editedModelUrl: SAMPLE_GLB_URL,
  receiverNote: "改好了，开吧",
  sealedAt: 1763203600000,
  openedAt: 1763207200000,
};
