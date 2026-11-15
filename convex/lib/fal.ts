const DEFAULT_BG_MODEL = "fal-ai/birefnet";

export async function removeBackground(imageUrl: string): Promise<Blob> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY 未配置");
  const model = process.env.FAL_BG_MODEL || DEFAULT_BG_MODEL;

  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, output_format: "png" }),
  });
  if (!res.ok) throw new Error(`fal 返回 ${res.status}：${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { image?: { url?: string } };
  const resultUrl = data.image?.url;
  if (!resultUrl) throw new Error("fal 返回里没有 image.url");

  const img = await fetch(resultUrl);
  if (!img.ok) throw new Error(`下载抠图结果失败：${img.status}`);
  return new Blob([await img.arrayBuffer()], { type: "image/png" });
}
