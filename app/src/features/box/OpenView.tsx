import { useMutation } from "convex/react";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useTask } from "../../lib/useTask";
import { Button, Muted, Screen } from "../../components/ui";
import { BoxHeader } from "./common";

// A：B 已封箱，开盲盒。开盒前后端不返回 B 的改造内容。
export function OpenView({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const open = useMutation(api.boxes.open);
  const { busy, run } = useTask();
  return (
    <Screen>
      <BoxHeader box={box} />
      <Muted>{box.receiverNickname} 改造好并封箱了，里面是什么？</Muted>
      <Button title="开盒！" busy={busy} onPress={() => run(() => open({ boxId: box._id, userId }))} />
    </Screen>
  );
}
