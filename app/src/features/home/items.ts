import type { BoxView, InboxItem } from "../../lib/backend";
import { colors } from "../../theme";
import type { Trailing } from "./BoxRow";

export type HomeItem = {
  key: string;
  boxId: BoxView["_id"];
  color: string;
  title: string;
  subtitle: string;
  trailing: Trailing;
  route: "arrived" | "box" | "invite";
  code: string;
  needsMe: boolean;
};

// boxes.inbox → Home 列表。received 在前（需要我动手的），sent 里去掉已经出现在 received 的 sealed 盒子；
// 分享母盒（shared）显示成邀请卡片。
export function toHomeItems(inbox: { received: InboxItem[]; sent: BoxView[] }): HomeItem[] {
  const receivedIds = new Set(inbox.received.map((b) => b._id));
  const order = { open: 0, edit: 1, claim: 2 };
  const received = [...inbox.received].sort((a, b) => order[a.action] - order[b.action]).map((box): HomeItem => {
    const base = { key: box._id, boxId: box._id, code: box.code, needsMe: true };
    if (box.action === "open") {
      const who = box.receiverNickname ?? "Someone";
      return { ...base, color: colors.orange, title: `${who} sent back your box`, subtitle: "Remixed and sealed", trailing: { kind: "dot" }, route: "arrived" };
    }
    const relay = box.replyTo !== undefined;
    return {
      ...base,
      color: colors.croc,
      title: relay ? `Remix ${box.senderNickname}'s box back` : `${box.senderNickname} sent you a box`,
      subtitle: box.status === "editing" ? "Bobo is working on your remix" : box.status === "edited" ? "Remix ready to seal" : "Waiting for your remix",
      trailing: { kind: "label", text: "Remix" },
      route: "box",
    };
  });
  const sent = inbox.sent
    .filter((box) => !receivedIds.has(box._id))
    .map((box): HomeItem => {
      const base = { key: box._id, boxId: box._id, code: box.code, needsMe: false, trailing: { kind: "none" } as Trailing, route: "box" as const };
      const who = box.receiverNickname;
      if (box.shared) return { ...base, color: colors.sun, title: `Invite code ${box.code}`, subtitle: "Share it so a friend can open one too", trailing: { kind: "label", text: "Share" }, route: "invite" };
      switch (box.status) {
        case "preparing":
          return { ...base, color: colors.sun, title: "Bobo is packing your box", subtitle: "Turning your photo into 3D…" };
        case "ready":
          return { ...base, color: colors.sun, title: who ? `Box for ${who}` : `Box ${box.code} is ready`, subtitle: who ? `Waiting for ${who} to take it` : "Waiting for a friend to take it" };
        case "claimed":
        case "editing":
        case "edited":
          return { ...base, color: colors.croc, title: `${who ?? "A friend"} is remixing your box`, subtitle: "You'll get it back sealed" };
        case "opened":
          return { ...base, color: colors.orange, title: `Opened: ${who ?? "a friend"}'s remix`, subtitle: "Tap to see it again" };
        default:
          return { ...base, color: colors.croc, title: `Box ${box.code}`, subtitle: "Sealed" };
      }
    });
  return [...received, ...sent];
}

export function bubbleMessage(newCount: number) {
  if (newCount === 0) return "Cozy day.\nNo new boxes.";
  return `Cozy day.\n${newCount} ${newCount === 1 ? "box" : "boxes"} came in!`;
}
