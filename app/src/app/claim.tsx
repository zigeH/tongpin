import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { api } from "../lib/backend";
import { useProfile } from "../lib/session";
import { useTask } from "../lib/useTask";
import { Button, Input, Screen, Section } from "../components/ui";

export default function ClaimScreen() {
  const { userId } = useProfile();
  const claim = useMutation(api.boxes.claim);
  const { busy, run } = useTask();
  const [code, setCode] = useState("");
  const trimmed = code.trim();
  const submit = () =>
    run(async () => {
      const { boxId } = await claim({ code: trimmed, userId });
      router.replace(`/box/${boxId}`);
    });
  return (
    <Screen>
      <Section title="对方给你的 6 位盒子码">
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          style={{ fontSize: 28, letterSpacing: 6, textAlign: "center" }}
        />
      </Section>
      <Button title="认领" busy={busy} disabled={trimmed.length === 0} onPress={submit} />
    </Screen>
  );
}
