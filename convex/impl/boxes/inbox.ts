import { query } from "../../_generated/server";
import { v } from "convex/values";
import { FAKE_BOX_VIEW } from "../../lib/mock";
import type { BoxView } from "../../lib/view";

export type InboxAction = "claim" | "edit" | "open";

export const inbox = query({
  args: { userId: v.id("users") },
  handler: async (): Promise<{ received: (BoxView & { action: InboxAction })[]; sent: BoxView[] }> => ({
    received: [{ ...FAKE_BOX_VIEW, status: "sealed", action: "open" }],
    sent: [FAKE_BOX_VIEW],
  }),
});
