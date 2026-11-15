import { useState } from "react";
import { useSession } from "../lib/session";
import { useTask } from "../lib/useTask";
import { Button, Input } from "../components/ui";

export function RegisterForm({ onDone, buttonTitle = "Log in" }: { onDone?: () => void; buttonTitle?: string }) {
  const { login } = useSession();
  const { busy, run } = useTask();
  const [nickname, setNickname] = useState("");
  const trimmed = nickname.trim();
  const submit = () =>
    run(async () => {
      if (!trimmed) return;
      await login(trimmed);
      setNickname("");
      onDone?.();
    });
  return (
    <>
      <Input value={nickname} onChangeText={setNickname} placeholder="Your username" maxLength={20} returnKeyType="done" autoCorrect={false} onSubmitEditing={submit} />
      <Button title={buttonTitle} busy={busy} disabled={trimmed.length === 0} onPress={submit} />
    </>
  );
}
