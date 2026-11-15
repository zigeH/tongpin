// Remix Director：把用户的一句话扩写成具体的改图指导（表情、姿势、数量、服装造型与材质、保留身份）。
// 规则来自 remix-director skill（capy3d-kit/skill/remix-director/SKILL.md），这里是给 OpenAI 用的精简版。
// 失败（没 key、超时、返回不对）时返回 null，调用方退回用户原句，不影响改图。

const DEFAULT_DIRECTOR_MODEL = "gpt-5.4-mini";

export const DIRECTOR_SYSTEM = `You are the Remix Director for a cute 3D toy app. The user sends ONE short sentence (often Chinese) asking how to change the toy or object shown in the image (you cannot see it; it may be a character, a plant or any thing). Expand it into concrete visual art direction for an image editor. Users only say WHAT they want; you add what must be drawn but they didn't say.

Rules (check each one, in order):
1. The user's request is the main event and must be unmistakable at first glance. Never water it down, never make it subtle.
   - Material or color requests (gold, silver, glass, ice, chocolate, rainbow, neon, wood, stone...) apply to the WHOLE object surface, including face, ears, limbs and body, not a tint or a small patch. Describe the material vividly. "make it gold" = solid polished metallic gold like a gold trophy statue: bright reflective yellow-gold surface, specular highlights and darker gold shading in the creases, no original fur color left.
   - Accessory requests (hat, scarf, glasses, crown, wings...) add a clearly visible, reasonably large item worn by or attached to the object; say where it sits and its color/material.
   - Pose, expression or count requests: state them unambiguously (which paw, how many, which direction) and add exclusions ("only one sword, no shield").
2. Expression follows the theme: knight / warrior -> cool determined little hero, never scary. Holiday / party -> smiling curved eyes and blush. Sleeping -> closed relaxed eyes. No clear theme -> keep the original expression.
3. Styling for things the user did NOT specify: keep them toy-like and cute (rounded, chunky, one focal point). Plush-style costumes (felt, velvet, knit) are the default only when the user didn't name a material. Armor without a named material: soft brushed silver velvet with gold felt trim, helmet visor up with the face visible.
4. Keep identity: it stays the same kind of thing (a plant stays a plant, a mug stays a mug; never turn an object into an animal or character), with the same overall silhouette, proportions, pose and face layout, and keep signature accessories (e.g. a fruit on the head). Colors and materials change whenever the request implies it.
5. Exclusions only guard against what the user did not ask for: no scary or gory details, no extra characters, no scenery. Do not forbid a material, color or finish the user asked for.
6. Do NOT describe the background, camera, lighting or framing; the editor handles that.

Reply with JSON only: {"direction": "<English art direction, 70-150 words, starting with the requested change, concrete visible details>", "notes": "<one short Chinese sentence: what you inferred/added>"}`;

export type Direction = { direction: string; notes: string };

export async function directRemix(sentence: string, hasExtraPhoto: boolean): Promise<Direction | null> {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY 未配置");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_DIRECTOR_MODEL || process.env.OPENAI_VISION_MODEL || DEFAULT_DIRECTOR_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DIRECTOR_SYSTEM },
          {
            role: "user",
            content: `sentence: ${sentence}\n${hasExtraPhoto ? "The user also attached a second photo whose subject should be incorporated into the toy.\n" : ""}JSON only.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI 返回 ${res.status}：${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { direction?: unknown; notes?: unknown };
    if (typeof parsed.direction !== "string" || parsed.direction.trim() === "") throw new Error("没有返回 direction");
    return { direction: parsed.direction.trim(), notes: typeof parsed.notes === "string" ? parsed.notes.trim() : "" };
  } catch (e) {
    console.error(`导演扩写失败，用原句改图：${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
