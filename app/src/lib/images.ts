import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_EDGE = 1536;

export type LocalImage = { uri: string; width: number; height: number };

// 拍照或从相册选一张图。相册保留原始格式（常见 HEIC），后面统一转 JPEG。
export async function pickImage(source: "camera" | "library"): Promise<LocalImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  };
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("没有相机权限");
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

// 后端只收 image/jpeg、image/png：转 JPEG，长边缩到 MAX_EDGE 以内。
export async function toUploadableJpeg(image: LocalImage): Promise<LocalImage> {
  const context = ImageManipulator.manipulate(image.uri);
  const longEdge = Math.max(image.width, image.height);
  if (longEdge > MAX_EDGE) {
    context.resize(image.width >= image.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
