import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useTask } from "../../lib/useTask";
import { ModelViewer } from "../../components/ModelViewer";
import { Button, Input, Muted, Screen, Section } from "../../components/ui";
import { BoxHeader, Picture } from "./common";

// 开盒后的结果（A 看到 B 的改造）；A 可以回礼。
export function ResultView({ box, canReply }: { box: BoxView; canReply: boolean }) {
  const { userId } = useProfile();
  const reply = useMutation(api.boxes.reply);
  const { busy, run } = useTask();
  const [note, setNote] = useState("");

  const sendReply = () =>
    run(async () => {
      const { boxId } = await reply({ boxId: box._id, userId, senderNote: note.trim() || undefined });
      router.replace(`/box/${boxId}`);
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
        <Section title="回礼">
          <Input value={note} onChangeText={setNote} placeholder="回一句话（可选）" maxLength={200} />
          <Button title="回礼" busy={busy} onPress={sendReply} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quote: { fontSize: 18 },
});
