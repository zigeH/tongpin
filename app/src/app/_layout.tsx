import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { convex } from "../lib/backend";
import { SessionProvider, useSession } from "../lib/session";
import { Loading } from "../components/ui";

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <StatusBar style="dark" />
        <Routes />
      </SessionProvider>
    </ConvexProvider>
  );
}

function Routes() {
  const { loaded, profile } = useSession();
  if (!loaded) return <Loading />;
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={{ title: "一起搭 · 盲盒" }} />
      <Stack.Screen name="settings" options={{ title: "设置 / 切换身份" }} />
      <Stack.Protected guard={profile !== null}>
        <Stack.Screen name="new" options={{ title: "寄一个盲盒" }} />
        <Stack.Screen name="claim" options={{ title: "输入盒子码" }} />
        <Stack.Screen name="box/[id]" options={{ title: "盒子" }} />
      </Stack.Protected>
    </Stack>
  );
}
