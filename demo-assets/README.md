# demo-assets

`scripts/seed.ts` 会把这里的素材上传后传给 `seed.demo`。按文件名（不含扩展名）对应，缺哪个就用 MOCK 默认素材（假 PNG / 示例 Duck.glb）。

| 文件名 | 对应字段 | 格式 |
| --- | --- | --- |
| `photo.jpg` / `photo.png` | 原照片 photoId | JPEG 或 PNG |
| `cutout.png` | 抠图 cutoutId | 透明 PNG |
| `model.glb` | 原版 3D modelId | GLB |
| `snapshot.png` | B 的定格图 snapshotId | 透明 PNG |
| `scene-shot.jpg` / `.png` | 合拍照 sceneShotId | JPEG 或 PNG |
| `extra-photo.jpg` / `.png` | B 的照片 extraPhotoId | JPEG 或 PNG |
| `edited-image.png` | 改图结果 editedImageId | 透明 PNG |
| `edited-model.glb` | 改后 3D editedModelId | GLB |

真实素材在 T3、T4、T6 跑通后用真实流程产出一份放进来。

运行：`npx tsx scripts/seed.ts`（读 `CONVEX_URL`，没设时读项目根目录 `.env.local`）。
