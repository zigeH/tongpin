import { File, Paths, UploadType } from "expo-file-system";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api, type Id } from "./backend";

type Mime = "image/jpeg" | "image/png";

async function uploadFile(uploadUrl: string, file: File, mime: Mime): Promise<Id<"_storage">> {
  const result = await file.upload(uploadUrl, {
    httpMethod: "POST",
    uploadType: UploadType.BINARY_CONTENT,
    headers: { "Content-Type": mime },
  });
  if (result.status < 200 || result.status >= 300) throw new Error(`上传失败：HTTP ${result.status}`);
  const { storageId } = JSON.parse(result.body) as { storageId?: Id<"_storage"> };
  if (!storageId) throw new Error("上传返回里没有 storageId");
  return storageId;
}

// files.generateUploadUrl → POST 文件 → storageId
export function useUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const uploadUri = useCallback(
    async (uri: string, mime: Mime) => uploadFile(await generateUploadUrl(), new File(uri), mime),
    [generateUploadUrl],
  );

  const uploadBase64 = useCallback(
    async (base64: string, mime: Mime) => {
      const file = new File(Paths.cache, `upload-${Date.now()}.${mime === "image/png" ? "png" : "jpg"}`);
      await file.write(base64, { encoding: "base64" });
      try {
        return await uploadFile(await generateUploadUrl(), file, mime);
      } finally {
        file.delete();
      }
    },
    [generateUploadUrl],
  );

  return { uploadUri, uploadBase64 };
}
