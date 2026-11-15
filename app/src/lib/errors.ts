import { ConvexError } from "convex/values";
import { Alert } from "react-native";

const MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "找不到这个用户，请到设置里重新注册",
  BOX_NOT_FOUND: "没有这个盒子，检查一下盒子码",
  NOT_READY: "盒子还在准备中，稍等一会儿再认领",
  ALREADY_CLAIMED: "这个盒子已经被别人认领了",
  NOT_RECEIVER: "只有收件人才能这样做",
  NOT_SENDER: "只有寄件人才能这样做",
  WRONG_STATUS: "盒子现在的状态不能这样做",
  INVALID_INPUT: "输入不对",
};

export function errorCode(error: unknown): string | undefined {
  if (error instanceof ConvexError && typeof error.data?.code === "string") return error.data.code;
  return undefined;
}

export function errorText(error: unknown): string {
  const code = errorCode(error);
  if (code) {
    const detail = (error as ConvexError<{ message?: string }>).data.message;
    const base = MESSAGES[code] ?? code;
    return detail && detail !== code && code === "INVALID_INPUT" ? `${base}：${detail}` : base;
  }
  const message = error instanceof Error ? error.message : String(error);
  return `出错了：${message.split("\n")[0]}`;
}

export function showError(error: unknown): void {
  Alert.alert("出错了", errorText(error));
}
