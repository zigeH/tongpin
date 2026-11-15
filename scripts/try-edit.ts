/**
 * T6 prompt tuning: run OpenAI image edits over scripts/samples/*.png.
 *
 *   OPENAI_API_KEY=... npx tsx scripts/try-edit.ts [options]
 *
 * Options:
 *   --model <id>        default: $OPENAI_IMAGE_MODEL or gpt-image-2.6-flare
 *   --template <name>   prompt template key (see TEMPLATES), default: v2
 *   --sample <name>     only this sample (file name without .png); repeatable
 *   --limit <n>         at most n instructions per sample
 *   --say <text>        use this instruction instead of the built-in list; repeatable
 *   --quality <q>       low | medium | high | auto (default: medium)
 *   --background <b>    transparent | opaque | auto (default: transparent)
 *   --extra <path>      second image (B's photo) passed as image[] #2
 *   --max-calls <n>     hard cap on API calls for this run (default: 9)
 *   --dry-run           print requests without calling the API
 *
 * Results land in scripts/out/<run>/ with an index.html contact sheet.
 * The v2 template is the one convex/edit.ts ships (buildEditPrompt); keep them in sync.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const ROOT = new URL("./", import.meta.url).pathname;
const SAMPLES_DIR = join(ROOT, "samples");
const OUT_DIR = join(ROOT, "out");

export const TEMPLATES: Record<string, (instruction: string, hasExtra: boolean) => string> = {
  plan: (instruction, hasExtra) =>
    [
      `Edit this object: ${instruction}. Keep it a single standalone object, fully visible, centered, same camera angle, on a plain white background, no extra scenery.`,
      hasExtra ? "Incorporate the subject from the second image into the object." : "",
    ].filter(Boolean).join(" "),
  v2: (instruction, hasExtra) =>
    [
      `The first image is a 3D object on a transparent background. Edit this object according to the user's request: "${instruction}".`,
      hasExtra ? "Incorporate the subject from the second image into the object as part of it, not as a separate item." : "",
      "Requirements: the result is exactly one standalone object; any added items are physically attached to it or worn by it.",
      "Show the whole object fully inside the frame with some empty margin, centered, same camera angle, scale and lighting as the input.",
      "Keep the original object recognizable unless the request asks to transform it.",
      "Transparent background: no floor, no ground shadow, no scenery, no props, no text, no frame or border.",
    ].filter(Boolean).join(" "),
};

const INSTRUCTIONS: Record<string, string[]> = {
  mug: ["变成一只小猫的样子", "给它戴上一顶圣诞帽", "做成金属机器人风格", "里面装满彩色糖果"],
  sneaker: ["长出一对翅膀", "改成用乐高积木拼的", "上面开满小花", "make it look like it's made of chocolate"],
  cactus: ["让它戴墨镜在海边开派对", "变成冰雕", "顶上长出一颗草莓", "变成一个毛绒玩具"],
};

type Args = {
  model: string; template: string; samples: string[]; say: string[]; limit?: number; quality: string;
  background: string; extra?: string; maxCalls: number; dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-flare",
    template: "v2", samples: [], say: [], quality: "medium", background: "transparent",
    maxCalls: 9, dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${flag}`);
      return v;
    };
    if (flag === "--model") args.model = value();
    else if (flag === "--template") args.template = value();
    else if (flag === "--sample") args.samples.push(value());
    else if (flag === "--say") args.say.push(value());
    else if (flag === "--limit") args.limit = Number(value());
    else if (flag === "--quality") args.quality = value();
    else if (flag === "--background") args.background = value();
    else if (flag === "--extra") args.extra = value();
    else if (flag === "--max-calls") args.maxCalls = Number(value());
    else if (flag === "--dry-run") args.dryRun = true;
    else throw new Error(`unknown flag ${flag}`);
  }
  if (!TEMPLATES[args.template]) throw new Error(`unknown template ${args.template}; have ${Object.keys(TEMPLATES).join(", ")}`);
  return args;
}

async function editImage(opts: {
  apiKey: string; model: string; prompt: string; quality: string; background: string;
  images: { name: string; bytes: Buffer; type: string }[];
}) {
  const form = new FormData();
  form.append("model", opts.model);
  form.append("prompt", opts.prompt);
  for (const img of opts.images) form.append("image[]", new Blob([new Uint8Array(img.bytes)], { type: img.type }), img.name);
  form.append("background", opts.background);
  form.append("output_format", "png");
  form.append("quality", opts.quality);
  form.append("size", "1024x1024");
  form.append("n", "1");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text) as { data?: { b64_json?: string }[]; usage?: unknown };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`OpenAI returned no image: ${text.slice(0, 300)}`);
  return { png: Buffer.from(b64, "base64"), usage: json.usage };
}

function contactSheet(rows: { sample: string; instruction: string; file?: string; error?: string }[], meta: string) {
  const cell = (src: string) => `<img src="${src}" style="width:256px;height:256px;object-fit:contain;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/16px 16px">`;
  const body = rows.map((r) =>
    `<tr><td>${cell(`../../samples/${r.sample}.png`)}</td><td>${r.file ? cell(r.file) : `<pre>${r.error}</pre>`}</td><td>${r.sample}<br><b>${r.instruction}</b></td></tr>`,
  ).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>try-edit</title><pre>${meta}</pre><table>${body}</table>`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !args.dryRun) throw new Error("OPENAI_API_KEY is not set (use --dry-run to preview)");

  const sampleFiles = (await readdir(SAMPLES_DIR)).filter((f) => f.endsWith(".png")).sort();
  const samples = sampleFiles.map((f) => basename(f, ".png")).filter((s) => args.samples.length === 0 || args.samples.includes(s));
  const extra = args.extra ? { name: basename(args.extra), bytes: await readFile(args.extra), type: args.extra.endsWith(".png") ? "image/png" : "image/jpeg" } : undefined;

  const jobs = samples.flatMap((sample) =>
    (args.say.length ? args.say : INSTRUCTIONS[sample] ?? ["变成一只小猫的样子", "给它戴上一顶圣诞帽", "变成冰雕"]).slice(0, args.limit).map((instruction, i) => ({ sample, instruction, i })),
  );
  if (jobs.length > args.maxCalls) throw new Error(`${jobs.length} calls planned, over --max-calls ${args.maxCalls}; narrow with --sample/--limit`);

  const run = `${new Date().toISOString().replace(/[:.]/g, "-")}_${args.template}_${args.model}`;
  const runDir = join(OUT_DIR, run);
  await mkdir(runDir, { recursive: true });
  const meta = JSON.stringify({ ...args, run, jobs: jobs.length }, null, 2);
  console.log(meta);

  const rows: { sample: string; instruction: string; file?: string; error?: string; ms?: number; usage?: unknown }[] = [];
  for (const job of jobs) {
    const prompt = TEMPLATES[args.template](job.instruction, !!extra);
    console.log(`\n[${job.sample} #${job.i}] ${job.instruction}\n  prompt: ${prompt}`);
    if (args.dryRun) continue;
    const images = [{ name: `${job.sample}.png`, bytes: await readFile(join(SAMPLES_DIR, `${job.sample}.png`)), type: "image/png" }];
    if (extra) images.push(extra);
    const started = Date.now();
    try {
      const { png, usage } = await editImage({ apiKey: apiKey!, model: args.model, prompt, quality: args.quality, background: args.background, images });
      const file = `${job.sample}__${job.i}.png`;
      await writeFile(join(runDir, file), png);
      rows.push({ ...job, file, ms: Date.now() - started, usage });
      console.log(`  ok ${file} in ${Date.now() - started}ms`);
    } catch (e) {
      rows.push({ ...job, error: String(e), ms: Date.now() - started });
      console.log(`  FAILED ${e}`);
    }
  }
  if (args.dryRun) return;
  await writeFile(join(runDir, "results.json"), JSON.stringify({ args, rows }, null, 2));
  await writeFile(join(runDir, "index.html"), contactSheet(rows, meta));
  console.log(`\nwrote ${runDir}/index.html`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
