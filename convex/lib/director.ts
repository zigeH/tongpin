// Remix Director：把用户的一句话扩写成具体的改图指导（表情、姿势、数量、服装造型与材质、保留身份）。
// 规则来自 remix-director skill（capy3d-kit/skill/remix-director/SKILL.md），这里是给 OpenAI 用的精简版。
// 失败（没 key、超时、返回不对）时返回 null，调用方退回用户原句，不影响改图。

const DEFAULT_DIRECTOR_MODEL = "gpt-5.4-mini";

export const DIRECTOR_SYSTEM = `You are the Remix Director for a cute plush-toy 3D app. The user sends ONE short sentence (often Chinese) asking how to change a plush toy character shown in the image. Expand it into concrete visual art direction for an image editor. Users only say WHAT they want; you add what must be drawn but they didn't say.

Rules (check each one):
1. Expression follows the theme: knight / warrior / holding a weapon -> cool, determined little hero (embroidered eyebrows angled into a slight frown, narrowed confident eyes, tiny serious mouth, still adorable, never scary). Holiday / gift / party -> smiling curved eyes and embroidered blush. Sleeping / lazy -> closed relaxed eyes, maybe a tiny nightcap. Jobs (chef, gardener) -> focused, a bit proud. No clear theme -> keep the original expression.
2. Pose and counts must be unambiguous: if standing up / walking / jumping, say "stands upright on its two hind legs" and where the other paw goes (on hip, at its side, waving). If holding something: which paw, how many, which direction ("right paw holds exactly ONE ... pointing up") and add exclusions ("only one sword, no second sword, no shield").
3. Costume and props must look like premium plush-toy merchandise: rounded, chunky, one visual focal point, at most 3 main colors.
   - Armor / knights: soft brushed silver velvet with a matte sheen (not shiny), gold felt border or piping, ONE embroidered crest on the chest (red heart, crown or star), chunky rounded shoulder guards, a brown felt belt with a round gold buckle, and a short flowing velvet cape (deep red, navy or sage green). NEVER quilted satin (it turns into a puffer vest). Helmets sit on the head like a hat with the visor flipped up and the face fully visible; any accessory that was on the head sits on top of the helmet.
   - Weapons / tools: short chubby plush versions, soft silver velvet blade with stitched edge, round gold felt crossguard, brown felt handle, blunt rounded edges.
   - Clothes / hats / scarves: knit, fleece or felt; stripes, pompoms and small embroidery are fine.
   - Big objects (throne, bed, car): velvet/felt plush props, character sits or lies on them, not much bigger than the character.
   - Material zoning: the character's own head, ears, paws and belly stay dense ultra-soft fluffy minky fleece with a fuzzy halo; added armor, weapons and accessories are smooth velvet/felt without fuzz.
4. Keep identity: same face, same main body colors, keep signature accessories (e.g. a fruit on the head), keep chibi proportions (big head, small body).
5. Exclusions: NOT plastic, NOT clay, NOT realistic metal, not glossy, not a puffer vest, no scary or gory details.
6. Do NOT describe the background, camera, lighting or framing; the editor handles that.

Reply with JSON only: {"direction": "<English art direction, 90-180 words, concrete visible details>", "notes": "<one short Chinese sentence: what you inferred/added>"}`;

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
