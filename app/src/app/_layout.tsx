import { ConvexProvider } from "convex/react";
import { Gaegu_700Bold } from "@expo-google-fonts/gaegu";
import { Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { convex } from "../lib/backend";
import { SessionProvider, useSession } from "../lib/session";
import { Loading } from "../components/ui";
import { colors, fonts } from "../theme";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Gaegu_700Bold, Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold });
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
        <StatusBar style="dark" />
        {fontsLoaded || fontError ? <Routes /> : <Loading />}
      </SessionProvider>
    </ConvexProvider>
  );
}

function Routes() {
  const { loaded, profile } = useSession();
  if (!loaded) return <Loading />;
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.hand, fontSize: 24, color: colors.ink },
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Bobo's boxes" }} />
      <Stack.Screen name="settings" options={{ title: "Who's playing?" }} />
      <Stack.Protected guard={profile !== null}>
        <Stack.Screen name="new" options={{ title: "Send a box" }} />
        <Stack.Screen name="claim" options={{ title: "Enter a box code" }} />
        <Stack.Screen name="box/[id]" options={{ title: "Box" }} />
        <Stack.Screen name="arrived/[id]" options={{ headerShown: false, animation: "fade" }} />
      </Stack.Protected>
    </Stack>
  );
}
