import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "../../lib/backend";
import { errorText } from "../../lib/errors";
import { useProfile } from "../../lib/session";
import { Button, ErrorText, Loading, Screen } from "../../components/ui";
import { ErrorBoundary as RouteErrorBoundary } from "../../features/RouteError";

export const ErrorBoundary = RouteErrorBoundary;

// Share link tongpin://c/<code>: claim the code and land on the box, which is the Remix screen.
export default function ClaimLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { userId } = useProfile();
  const claim = useMutation(api.boxes.claim);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    claim({ code, userId })
      .then(({ boxId }) => router.replace(`/box/${boxId}`))
      .catch((e: unknown) => setError(errorText(e)));
  }, [code, userId, claim]);

  if (!error) return <Loading label="Opening the box…" />;
  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <Button title="Back home" onPress={() => router.dismissTo("/")} />
    </Screen>
  );
}
