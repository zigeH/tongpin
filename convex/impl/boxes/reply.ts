import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { FAKE_BOX_ID } from "../../lib/mock";

export const reply = mutation({
  args: { boxId: v.id("boxes"), userId: v.id("users"), senderNote: v.optional(v.string()) },
  handler: async () => ({ boxId: FAKE_BOX_ID }),
});
