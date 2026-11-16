import { isARSupportedOnDevice } from "@reactvision/react-viro";
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api, type Id } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { Loading } from "../../components/ui";
import { ARPhotoBoothScreen } from "../../screens/photo/ARPhotoBoothScreen";
import { PhotoBoothScreen } from "../../screens/photo/PhotoBoothScreen";
import { ErrorBoundary as RouteErrorBoundary } from "../../features/RouteError";

export const ErrorBoundary = RouteErrorBoundary;

// 开盒后和 3D 合影：支持 ARKit 的 iPhone 用真 AR（ViroReact），其他设备（含模拟器、Android）用 WebView 相机 + 3D。
export default function PhotoRoute() {
  const { id } = useLocalSearchParams<{ id: Id<"boxes"> }>();
  const { userId } = useProfile();
  const box = useQuery(api.boxes.get, { boxId: id, viewerId: userId });
  const [ar, setAr] = useState<boolean | undefined>(Platform.OS === "ios" ? undefined : false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    isARSupportedOnDevice()
      .then((r) => setAr("isARSupported" in r && r.isARSupported))
      .catch(() => setAr(false));
  }, []);

  if (box === undefined || ar === undefined) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {ar ? <ARPhotoBoothScreen box={box} /> : <PhotoBoothScreen box={box} />}
    </>
  );
}
