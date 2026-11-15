import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { FAKE_USER_ID } from "./lib/mock";

export const register = mutation({
  args: { nickname: v.string() },
  handler: async (_ctx, { nickname }) => ({ userId: FAKE_USER_ID, nickname, color: "#FF8C00" }),
});
