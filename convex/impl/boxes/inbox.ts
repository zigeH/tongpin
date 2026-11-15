import { query } from "../../_generated/server";
import { v } from "convex/values";
import { fail } from "../../lib/errors";
import type { BoxStatus } from "../../lib/status";
import { toBoxView, type BoxView } from "../../lib/view";

export type InboxAction = "claim" | "edit" | "open";

const LIMIT = 50;

const RECEIVER_ACTIONS: Partial<Record<BoxStatus, InboxAction>> = {
  ready: "claim",
  claimed: "edit",
  editing: "edit",
  edited: "edit",
};

export const inbox = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ received: (BoxView & { action: InboxAction })[]; sent: BoxView[] }> => {
    if ((await ctx.db.get(userId)) === null) fail("USER_NOT_FOUND");

    const toReceive = await ctx.db
      .query("boxes")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "ready"),
          q.eq(q.field("status"), "claimed"),
          q.eq(q.field("status"), "editing"),
          q.eq(q.field("status"), "edited"),
        ),
      )
      .take(LIMIT);
    const toOpen = await ctx.db
      .query("boxes")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "sealed"))
      .take(LIMIT);
    const sent = await ctx.db
      .query("boxes")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .order("desc")
      .take(LIMIT);

    const received = [...toReceive, ...toOpen]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, LIMIT);

    return {
      received: await Promise.all(
        received.map(async (box) => ({
          ...(await toBoxView(ctx, box, userId)),
          action: box.status === "sealed" ? ("open" as const) : RECEIVER_ACTIONS[box.status]!,
        })),
      ),
      sent: await Promise.all(sent.map((box) => toBoxView(ctx, box, userId))),
    };
  },
});
