import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: (ctx) => ctx.db.query("items").order("desc").collect(),
});

export const add = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await ctx.db.insert("items", { text: trimmed });
  },
});
