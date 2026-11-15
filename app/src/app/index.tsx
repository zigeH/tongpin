import { Stack } from "expo-router";
import { useSession } from "../lib/session";
import { ErrorBoundary as RouteErrorBoundary } from "../features/RouteError";
import { HomeScreen } from "../features/home/HomeScreen";
import { WelcomeScreen } from "../features/home/WelcomeScreen";

export const ErrorBoundary = RouteErrorBoundary;

export default function IndexScreen() {
  const { profile } = useSession();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {profile ? <HomeScreen key={profile.userId} profile={profile} /> : <WelcomeScreen />}
    </>
  );
}
