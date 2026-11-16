import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { api, type BoxView } from "../../lib/backend";
import { errorText } from "../../lib/errors";
import { useProfile } from "../../lib/session";
import { Button, ErrorText, Loading, Screen } from "../../components/ui";

// A box that isn't mine yet (a friend's share in the inbox, a link, a code): claim it on arrival so the
// route swaps straight to the Remix screen. Claiming a share's invite code returns my own copy, so jump there.
export function ClaimView({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const claim = useMutation(api.boxes.claim);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    claim({ code: box.code, userId })
      .then(({ boxId }) => {
        if (boxId !== box._id) router.replace(`/box/${boxId}`);
      })
      .catch((e: unknown) => setError(errorText(e)));
  }, [box._id, box.code, userId, claim, attempt]);

  if (!error) return <Loading label="Opening the box…" />;
  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <Button title="Try again" onPress={() => setAttempt((n) => n + 1)} />
      <Button title="Back home" kind="ghost" onPress={() => router.dismissTo("/")} />
    </Screen>
  );
}
