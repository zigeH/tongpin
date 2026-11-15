import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

export async function newUniqueCode(ctx: { db: GenericDatabaseReader<DataModel> }): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const existing = await ctx.db
      .query("boxes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing === null) return code;
  }
  throw new Error("10 次都没生成出不重复的盒子码");
}
