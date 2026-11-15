import type { BoxStatus } from "./backend";

export const STATUS_TEXT: Record<BoxStatus, string> = {
  preparing: "准备中（抠图 + 生成 3D）",
  ready: "已就绪，等对方认领",
  claimed: "已认领，等待改造",
  editing: "改造中",
  edited: "改造完成，待封箱",
  sealed: "已封箱，等寄件人开盒",
  opened: "已开盒",
};
