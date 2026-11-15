import { useMutation } from "convex/react";
import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useTask } from "../../lib/useTask";
import { ModelViewer } from "../../components/ModelViewer";
import { Button, Muted, Screen, Section } from "../../components/ui";
import { BoxHeader, Picture } from "./common";

// 开盒后的结果（A 看到 B 的改造）；A 可以在 B 的结果上再改一次寄回（boxes.remixBack）。
export function ResultView({ box, canReply }: { box: BoxView; canReply: boolean }) {
  const { userId } = useProfile();
  const remixBack = useMutation(api.boxes.remixBack);
  const { busy, run } = useTask();

  const sendBack = () =>
    run(async () => {
      const { boxId } = await remixBack({ boxId: box._id, userId });
      router.push(`/box/${boxId}`);
    });

  return (
    <Screen>
      <BoxHeader box={box} />
      {box.receiverNote ? (
        <Section title={`${box.receiverNickname ?? "对方"} 说`}>
          <Text style={styles.quote}>“{box.receiverNote}”</Text>
        </Section>
      ) : null}
      {box.prompt ? <Muted>改造指令：{box.prompt}</Muted> : null}
      {box.editedImageUrl ? <Picture uri={box.editedImageUrl} label="改后图片" /> : null}
      {box.editedModelUrl ? (
        <Section title="改后 3D（可拖动）">
          <ModelViewer modelUrl={box.editedModelUrl} />
        </Section>
      ) : null}
      {box.snapshotUrl ? <Picture uri={box.snapshotUrl} label="对方定格的角度" /> : null}
      {box.extraPhotoUrl ? <Picture uri={box.extraPhotoUrl} label="对方加的参考照片" /> : null}
      {canReply ? (
        <Button title="Remix it and send it back" busy={busy} onPress={sendBack} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quote: { fontSize: 18 },
});
