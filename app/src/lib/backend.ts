import { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export { api };
export type { Id } from "../../../convex/_generated/dataModel";
export type { BoxView, CameraPose } from "../../../convex/lib/view";
export type { BoxStatus } from "../../../convex/lib/status";

export type InboxItem = FunctionReturnType<typeof api.boxes.inbox>["received"][number];

export const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://moonlit-curlew-733.convex.cloud";

export const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false });
