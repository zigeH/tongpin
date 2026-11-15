import { ConvexError } from "convex/values";

export const ERROR_CODES = [
  "USER_NOT_FOUND",
  "BOX_NOT_FOUND",
  "NOT_READY",
  "ALREADY_CLAIMED",
  "NOT_RECEIVER",
  "NOT_SENDER",
  "WRONG_STATUS",
  "INVALID_INPUT",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppErrorData = { code: ErrorCode; message: string };

export function fail(code: ErrorCode, message?: string): never {
  throw new ConvexError<AppErrorData>({ code, message: message ?? code });
}
