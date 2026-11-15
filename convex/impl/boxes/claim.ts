import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { FAKE_BOX_ID } from "../../lib/mock";

export const claim = mutation({
  args: { code: v.string(), userId: v.id("users") },
  handler: async () => ({ boxId: FAKE_BOX_ID }),
});
