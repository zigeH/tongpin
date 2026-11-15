import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { fail } from "./errors";

export type BoxStatus = Doc<"boxes">["status"];

export const modelKind = v.union(v.literal("original"), v.literal("edited"));
export type ModelKind = "original" | "edited";

export const ALLOWED_TRANSITIONS: Record<BoxStatus | "new", readonly BoxStatus[]> = {
  new: ["preparing", "ready", "claimed"],
  preparing: ["ready"],
  ready: ["claimed"],
  claimed: ["editing"],
  editing: ["edited", "claimed"],
  edited: ["editing", "sealed"],
  sealed: ["opened"],
  opened: [],
};

export function assertStatus<T extends { status: BoxStatus }, S extends BoxStatus>(
  box: T,
  ...allowed: S[]
): asserts box is T & { status: S } {
  if (!(allowed as BoxStatus[]).includes(box.status)) {
    fail("WRONG_STATUS", `当前状态 ${box.status}，需要 ${allowed.join(" / ")}`);
  }
}
