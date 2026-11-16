import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { api, type Id } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { Loading } from "../../components/ui";
import { ClaimView } from "../../features/box/ClaimView";
import { EditView } from "../../features/box/EditView";
import { OpenView } from "../../features/box/OpenView";
import { ResultView } from "../../features/box/ResultView";
import { SenderWaitingView } from "../../features/box/SenderWaitingView";
import { ErrorBoundary as RouteErrorBoundary } from "../../features/RouteError";

export const ErrorBoundary = RouteErrorBoundary;

// 一个盒子一个页面：按"我是谁 + 盒子状态"决定显示哪一步。
// 对应 inbox 的 action：好友直接分享给我的（claim/edit）→ EditView（分享卡片直接开始 remix），open → OpenView；
// 只有拿着别人的盒子码进来的才走 ClaimView。
export default function BoxScreen() {
  const { id } = useLocalSearchParams<{ id: Id<"boxes"> }>();
  const { userId } = useProfile();
  const box = useQuery(api.boxes.get, { boxId: id, viewerId: userId });
  if (box === undefined) return <Loading />;

  const title = <Stack.Screen options={{ title: `盒子 ${box.code}` }} />;
  const isSender = box.senderId === userId;
  const isReceiver = box.receiverId === userId;

  let body;
  if (isSender && (box.status === "sealed" || box.status === "opened")) body = <OpenView box={box} />;
  else if (box.status === "opened") body = <ResultView box={box} canReply={false} />;
  else if (isSender) body = <SenderWaitingView box={box} />;
  else if (isReceiver) body = box.status === "sealed" ? <ResultView box={box} canReply={false} /> : <EditView box={box} />;
  else body = <ClaimView box={box} />;

  return (
    <>
      {title}
      {body}
    </>
  );
}
