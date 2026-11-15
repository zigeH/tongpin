import { useState } from "react";
import { useSession } from "../lib/session";
import { useTask } from "../lib/useTask";
import { Button, Input } from "../components/ui";

export function RegisterForm({ onDone }: { onDone?: () => void }) {
  const { register } = useSession();
  const { busy, run } = useTask();
  const [nickname, setNickname] = useState("");
  const trimmed = nickname.trim();
  const submit = () =>
    run(async () => {
      await register(trimmed);
      setNickname("");
      onDone?.();
    });
  return (
    <>
      <Input value={nickname} onChangeText={setNickname} placeholder="昵称（1–20 字）" maxLength={20} returnKeyType="done" onSubmitEditing={submit} />
      <Button title="注册" busy={busy} disabled={trimmed.length === 0} onPress={submit} />
    </>
  );
}
