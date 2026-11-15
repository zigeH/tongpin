import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
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

function cleanNickname(raw: string): string {
  const nickname = raw.trim();
  if (nickname.length < 1 || nickname.length > 20) {
    fail("INVALID_INPUT", "昵称去掉首尾空格后需要 1–20 个字");
  }
  return nickname;
}

async function createUser(ctx: MutationCtx, nickname: string) {
  const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  const userId = await ctx.db.insert("users", { nickname, color, createdAt: Date.now() });
  return { userId, nickname, color };
}

const oldest = (users: Doc<"users">[]) =>
  users.reduce<Doc<"users"> | null>((best, u) => (best === null || u.createdAt < best.createdAt || (u.createdAt === best.createdAt && u._creationTime < best._creationTime) ? u : best), null);

async function findOrCreate(ctx: MutationCtx, nickname: string) {
  const exact = oldest(await ctx.db.query("users").withIndex("by_nickname", (q) => q.eq("nickname", nickname)).collect());
  const lower = nickname.toLowerCase();
  const found = exact ?? oldest((await ctx.db.query("users").collect()).filter((u) => u.nickname.toLowerCase() === lower));
  if (found === null) return createUser(ctx, nickname);
  return { userId: found._id, nickname: found.nickname, color: found.color };
}

export const register = mutation({
  args: { nickname: v.string() },
  handler: async (ctx, args) => createUser(ctx, cleanNickname(args.nickname)),
});

// 只输入用户名就登录：有同名（不分大小写）用户就返回它，没有就新建。
export const login = mutation({
  args: { nickname: v.string() },
  handler: async (ctx, args) => findOrCreate(ctx, cleanNickname(args.nickname)),
});

export const seedDemoFriends = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ karaId: Id<"users">; vincentId: Id<"users"> }> => {
    const { userId: karaId } = await findOrCreate(ctx, "kara");
    const { userId: vincentId } = await findOrCreate(ctx, "vincent");
    const linked = [
      ...(await ctx.db.query("friendships").withIndex("by_userA", (q) => q.eq("userA", karaId)).collect()).map((f) => f.userB),
      ...(await ctx.db.query("friendships").withIndex("by_userB", (q) => q.eq("userB", karaId)).collect()).map((f) => f.userA),
    ];
    if (!linked.includes(vincentId)) {
      await ctx.db.insert("friendships", { userA: karaId, userB: vincentId, createdAt: Date.now() });
    }
    return { karaId, vincentId };
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
    const ordered = [...lastSeen].sort((a, b) => b[1] - a[1]).map(([id]) => id);

    const asA = await ctx.db.query("friendships").withIndex("by_userA", (q) => q.eq("userA", userId)).take(FRIEND_SCAN);
    const asB = await ctx.db.query("friendships").withIndex("by_userB", (q) => q.eq("userB", userId)).take(FRIEND_SCAN);
    const explicit = [...asA.map((f) => ({ id: f.userB, at: f.createdAt })), ...asB.map((f) => ({ id: f.userA, at: f.createdAt }))]
      .sort((a, b) => a.at - b.at)
      .map((f) => f.id);
    for (const id of explicit) if (id !== userId && !ordered.includes(id)) ordered.push(id);

    const users = await Promise.all(ordered.map((id) => ctx.db.get(id)));
    return users.flatMap((user) => (user === null ? [] : [{ userId: user._id, nickname: user.nickname, color: user.color }]));
  },
});
