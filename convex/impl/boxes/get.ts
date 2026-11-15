import { query } from "../../_generated/server";
import { v } from "convex/values";
import { FAKE_BOX_VIEW } from "../../lib/mock";
import type { BoxView } from "../../lib/view";

export const get = query({
  args: { boxId: v.id("boxes"), viewerId: v.optional(v.id("users")) },
  handler: async (_ctx, { boxId }): Promise<BoxView> => ({ ...FAKE_BOX_VIEW, _id: boxId }),
});
