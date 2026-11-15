const BASE = "https://api.meshy.ai/openapi";
const DEFAULT_VISION_MODEL = "gpt-5.4-mini";

export type MeshyResource = "image-to-image" | "multi-image-to-3d" | "retexture";

export type MeshyTask = {
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress?: number;
  image_urls?: string[];
  model_urls?: { glb?: string };
  task_error?: { message?: string };
};

export const FALLBACK_SUBJECT =
  "cute rounded object with simple friendly features, same shape, colors and details as the reference";
export const FALLBACK_COLORS = "same colors as the reference";

export const CLEAN_REF = (subject: string) =>
  `Product photo of this exact toy, redrawn as a clean studio reference for 3D modeling. ` +
  `Front three-quarter view from slightly above, the whole toy fully visible and centered, plain pure white background, ` +
  `soft even diffuse lighting, no harsh shadows, no other objects. Keep its exact identity: ${subject}. ` +
  `Same colors and proportions as the reference.`;

export const VIEWS_BASE = (subject: string) =>
  `Cute 3D render of this exact stuffed animal, high-end plush toy photography. ` +
  `Chibi proportions: big round head, small chubby body, rounded smooth edges, soft puffy silhouette, stuffed volume, no sharp corners. ` +
  `Material: ultra-soft fluffy plush, short-pile minky fabric and fuzzy polyester fleece with visible soft fibers and a gentle fuzzy halo along the edges, subtle hand-stitched seams. ` +
  `NOT plastic, NOT vinyl, NOT clay, NOT flocked, NOT leather, not glossy, no long shaggy fur. ` +
  `${subject}. ` +
  `Soft diffuse studio lighting with a warm rim light on the fuzz, pastel palette, plain solid light cream background, whole toy fully visible and centered, natural resting pose. ` +
  `No text, no labels, no watermark. Keep identity, colors and proportions consistent with the reference. `;

export const VIEW_ANGLES = {
  front: "Exact front view, camera straight in front of the face at eye level, symmetric.",
  side: "Exact left side profile view at eye level, head pointing left, big round head clearly visible.",
  back: "Exact back view, camera directly behind the toy at eye level, showing the round back, the ears and any accessory on the head.",
};

export const COZY_STYLE = (subject: string) =>
  `Cute 3D render of this exact stuffed animal, high-end cozy plush toy photography. ` +
  `Chibi proportions: big round head, small chubby body, rounded smooth edges, soft puffy silhouette, stuffed volume. ` +
  `Made of cozy, cloud-soft brushed fleece and velvety minky plush fabric, dense short velvety pile, cashmere-soft touch, soft chenille texture, warm blanket-like fabric, ` +
  `gentle fuzz catching the light along the edges, slightly squishy and huggable, subtle hand-stitched seams. ` +
  `${subject}. ` +
  `Soft diffuse studio lighting, warm gentle rim light on the fuzz, cozy pastel palette, plain solid light cream background, whole toy fully visible and centered. ` +
  `NOT plastic, NOT vinyl, NOT clay, NOT flocked, NOT leather or faux leather, NOT glossy, no long shaggy fur. No text, no labels, no watermark. ` +
  `Exact front view, camera straight in front of the face at eye level, symmetric.`;

export const TEXTURE_PROMPT = (colors: string) =>
  `cozy cloud-soft brushed fleece and velvety minky plush, dense short pile, warm huggable fabric, ${colors}`;

export const SUBJECT_PROMPT = [
  "Describe the main object in this photo for a 3D modeling prompt.",
  'Reply with JSON only: {"subject": "...", "colors": "..."}.',
  "subject: one English sentence listing what is visible: what it is (species or character), body structure (humanoid / four-legged / object), signature features (accessories, colors, patches, where the eyes, ears, nose sit).",
  "Only describe what you can see; do not invent accessories.",
  "colors: a short English phrase of the main colors and accessories, for texturing.",
].join(" ");

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY 未配置");
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meshy ${method} ${path} 返回 ${res.status}：${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export async function createTask(resource: MeshyResource, body: Record<string, unknown>): Promise<string> {
  return (await call<{ result: string }>("POST", `/v1/${resource}`, body)).result;
}

export function getTask(resource: MeshyResource, id: string): Promise<MeshyTask> {
  return call<MeshyTask>("GET", `/v1/${resource}/${id}`);
}

export async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`读取图片失败：HTTP ${res.status}`);
  const blob = await res.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

export async function describeSubject(imageDataUrl: string): Promise<{ subject: string; colors: string }> {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY 未配置");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || DEFAULT_VISION_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SUBJECT_PROMPT },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI 返回 ${res.status}：${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { subject?: unknown; colors?: unknown };
    if (typeof parsed.subject !== "string" || parsed.subject.trim() === "") throw new Error("OpenAI 没有返回 subject");
    const colors = typeof parsed.colors === "string" && parsed.colors.trim() !== "" ? parsed.colors.trim() : FALLBACK_COLORS;
    return { subject: parsed.subject.trim(), colors };
  } catch (e) {
    console.error(`主体描述失败，用通用描述：${e instanceof Error ? e.message : String(e)}`);
    return { subject: FALLBACK_SUBJECT, colors: FALLBACK_COLORS };
  }
}
