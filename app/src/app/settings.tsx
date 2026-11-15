import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CONVEX_URL } from "../lib/backend";
import { useSession } from "../lib/session";
import { useTask } from "../lib/useTask";
import { Button, Muted, Screen, Section } from "../components/ui";
import { RegisterForm } from "../features/RegisterForm";

export default function SettingsScreen() {
  const { profile, profiles, switchTo, forget } = useSession();
  const { busy, run } = useTask();
  return (
    <Screen>
      <Section title="本机的身份（点一下切换）">
        {profiles.length === 0 ? <Muted>还没有注册过</Muted> : null}
        {profiles.map((p) => {
          const current = p.userId === profile?.userId;
          return (
            <Pressable
              key={p.userId}
              style={[styles.row, current && styles.rowCurrent]}
              onPress={() => run(async () => { await switchTo(p.userId); router.dismissTo("/"); })}
            >
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={styles.name}>{p.nickname}</Text>
              <Text style={styles.current}>{current ? "当前" : "切换"}</Text>
            </Pressable>
          );
        })}
      </Section>
      <Section title="注册一个新昵称">
        <RegisterForm onDone={() => router.dismissTo("/")} />
      </Section>
      {profile ? (
        <Section title="当前身份">
          <Muted>userId：{profile.userId}</Muted>
          <Button title={`在本机忘掉「${profile.nickname}」`} kind="secondary" busy={busy} onPress={() => run(() => forget(profile.userId))} />
        </Section>
      ) : null}
      <Muted>后端：{CONVEX_URL}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: "#fff" },
  rowCurrent: { borderWidth: 2, borderColor: "#222" },
  dot: { width: 14, height: 14, borderRadius: 7 },
  name: { flex: 1, fontSize: 16 },
  current: { color: "#007aff" },
});
