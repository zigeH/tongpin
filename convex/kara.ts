import { internalAction, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { FAKE_BOX_ID, FAKE_IMAGE_DATA_URL } from "./lib/mock";
import { modelKind, type ModelKind } from "./lib/status";

export const request = internalAction({
  args: { boxId: v.id("boxes"), kind: modelKind },
  handler: async () => null,
});

export const fake = internalAction({
  args: { boxId: v.id("boxes"), kind: modelKind },
  handler: async () => null,
});

export const pending = query({
  args: {},
  handler: async (): Promise<{ boxId: Id<"boxes">; kind: ModelKind; imageUrl: string }[]> => [
    { boxId: FAKE_BOX_ID, kind: "original", imageUrl: FAKE_IMAGE_DATA_URL },
  ],
});
