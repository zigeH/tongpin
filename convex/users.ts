import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

const FRIEND_SCAN = 500;

export const friends = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ userId: Id<"users">; nickname: string; color: string }[]> => {
    if ((await ctx.db.get(userId)) === null) fail("USER_NOT_FOUND");
    const sent = await ctx.db.query("boxes").withIndex("by_sender", (q) => q.eq("senderId", userId)).order("desc").take(FRIEND_SCAN);
    const received = await ctx.db.query("boxes").withIndex("by_receiver", (q) => q.eq("receiverId", userId)).order("desc").take(FRIEND_SCAN);

    const lastSeen = new Map<Id<"users">, number>();
    for (const box of [...sent, ...received]) {
      const other = box.senderId === userId ? box.receiverId : box.senderId;
      if (other === undefined || other === userId) continue;
      const at = Math.max(box._creationTime, box.sealedAt ?? 0, box.openedAt ?? 0);
      if (at > (lastSeen.get(other) ?? -1)) lastSeen.set(other, at);
    }

    const ordered = [...lastSeen].sort((a, b) => b[1] - a[1]);
    const users = await Promise.all(ordered.map(([id]) => ctx.db.get(id)));
    return users.flatMap((user) => (user === null ? [] : [{ userId: user._id, nickname: user.nickname, color: user.color }]));
  },
});
