const DEFAULT_IMAGE_MODEL = "gpt-image-2.6-flare";

export const CUTOUT_PROMPT = [
  "Remove the background from this photo and output only the main object on a fully transparent background.",
  "Keep the object exactly as it is: do not change its shape, proportions, colors, materials, textures, text, logos or any details, and do not add or remove anything on it.",
  "Show the whole object fully visible and centered with a small empty margin, from the same camera angle.",
  "No floor, no shadow, no reflection, no scenery, no props, no frame or border.",
].join(" ");

export async function removeBackground(imageUrl: string): Promise<Blob> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 未配置");

  const source = await fetch(imageUrl);
  if (!source.ok) throw new Error(`读取原图失败：${source.status}`);
  const image = await source.blob();
  const type = image.type === "image/png" ? "image/png" : "image/jpeg";

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL);
  form.append("prompt", CUTOUT_PROMPT);
  form.append("image[]", new Blob([image], { type }), type === "image/png" ? "photo.png" : "photo.jpg");
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("quality", "medium");
  form.append("size", "auto");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI 返回 ${res.status}：${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 返回里没有图片");
  return new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: "image/png" });
}
