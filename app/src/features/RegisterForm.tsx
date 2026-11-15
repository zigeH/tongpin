import { useState } from "react";
import { useSession } from "../lib/session";
import { useTask } from "../lib/useTask";
import { Button, Input } from "../components/ui";

export function RegisterForm({ onDone, buttonTitle = "Let's go" }: { onDone?: () => void; buttonTitle?: string }) {
  const { register } = useSession();
  const { busy, run } = useTask();
  const [nickname, setNickname] = useState("");
  const trimmed = nickname.trim();
  const submit = () =>
    run(async () => {
      if (!trimmed) return;
      await register(trimmed);
      setNickname("");
      onDone?.();
    });
  return (
    <>
      <Input value={nickname} onChangeText={setNickname} placeholder="Your nickname" maxLength={20} returnKeyType="done" autoCorrect={false} onSubmitEditing={submit} />
      <Button title={buttonTitle} busy={busy} disabled={trimmed.length === 0} onPress={submit} />
    </>
  );
}
