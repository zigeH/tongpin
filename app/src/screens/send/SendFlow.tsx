import { Stack } from "expo-router";
import { View } from "react-native";
import type { BoxView } from "../../lib/backend";
import { SentScreen } from "./SentScreen";
import { ShareScreen } from "./ShareScreen";
import { colors } from "../../theme";
import { WaitingScreen } from "./WaitingScreen";

// 寄件人视角、开盒之前：preparing → 等待页；ready → 分享页；之后 → 进度页。
export function SendFlow({ box }: { box: BoxView }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen options={{ headerShown: false }} />
      {box.status === "preparing" ? (
        <WaitingScreen box={box} />
      ) : box.status === "ready" ? (
        <ShareScreen box={box} />
      ) : (
        <SentScreen box={box} />
      )}
    </View>
  );
}
