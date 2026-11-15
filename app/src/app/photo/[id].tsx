import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { api, type Id } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { Loading } from "../../components/ui";
import { PhotoBoothScreen } from "../../screens/photo/PhotoBoothScreen";
import { ErrorBoundary as RouteErrorBoundary } from "../../features/RouteError";

export const ErrorBoundary = RouteErrorBoundary;

// 开盒后和 3D 合影：相机 + 可拖动的 3D，拍照合成后存回盒子。
export default function PhotoRoute() {
  const { id } = useLocalSearchParams<{ id: Id<"boxes"> }>();
  const { userId } = useProfile();
  const box = useQuery(api.boxes.get, { boxId: id, viewerId: userId });
  if (box === undefined) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PhotoBoothScreen box={box} />
    </>
  );
}
