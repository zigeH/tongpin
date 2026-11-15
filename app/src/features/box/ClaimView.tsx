import { useMutation } from "convex/react";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useTask } from "../../lib/useTask";
import { Button, Muted, Screen } from "../../components/ui";
import { BoxHeader } from "./common";

// B 还没认领：一键认领（用盒子码）。
export function ClaimView({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const claim = useMutation(api.boxes.claim);
  const { busy, run } = useTask();
  return (
    <Screen>
      <BoxHeader box={box} />
      <Muted>盒子码 {box.code}</Muted>
      <Button title="认领这个盒子" busy={busy} onPress={() => run(() => claim({ code: box.code, userId }))} />
    </Screen>
  );
}
