import { useQuery } from "convex/react";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { api, type Id } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { Loading } from "../../components/ui";
import { ArrivedScreen } from "../../features/arrived/ArrivedScreen";
import { ErrorBoundary as RouteErrorBoundary } from "../../features/RouteError";

export const ErrorBoundary = RouteErrorBoundary;

// A 收到 B 封箱寄回的盒子：只有寄件人 + sealed 才演这一段，否则直接进盒子页。
export default function ArrivedRoute() {
  const { id } = useLocalSearchParams<{ id: Id<"boxes"> }>();
  const { userId } = useProfile();
  const box = useQuery(api.boxes.get, { boxId: id, viewerId: userId });
  if (box === undefined) return <Loading />;
  if (box.senderId !== userId || box.status !== "sealed") return <Redirect href={`/box/${id}`} />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ArrivedScreen box={box} />
    </>
  );
}
