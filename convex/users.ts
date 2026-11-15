import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { fail } from "./lib/errors";

export const USER_COLORS = [
  "#FF6B6B",
  "#FF9F43",
  "#FECA57",
  "#1DD1A1",
  "#48DBFB",
  "#54A0FF",
  "#5F27CD",
  "#FF6FB5",
] as const;

export const register = mutation({
  args: { nickname: v.string() },
  handler: async (ctx, args) => {
    const nickname = args.nickname.trim();
    if (nickname.length < 1 || nickname.length > 20) {
      fail("INVALID_INPUT", "昵称去掉首尾空格后需要 1–20 个字");
    }
    const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const userId = await ctx.db.insert("users", { nickname, color, createdAt: Date.now() });
    return { userId, nickname, color };
  },
});
