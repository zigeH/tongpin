import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CONVEX_URL } from "../lib/backend";
import { useSession } from "../lib/session";
import { useTask } from "../lib/useTask";
import { Avatar, Button, Muted, Screen, Section } from "../components/ui";
import { RegisterForm } from "../features/RegisterForm";
import { colors, fonts, radii, stroke } from "../theme";

// 一台手机扮演多个人：切换、用户名登录（没有就新建）、忘掉。
export default function SettingsScreen() {
  const { profile, profiles, switchTo, forget } = useSession();
  const { busy, run } = useTask();
  return (
    <Screen>
      <Section title="Players on this phone">
        {profiles.length === 0 ? <Muted>Nobody yet.</Muted> : null}
        {profiles.map((p) => {
          const current = p.userId === profile?.userId;
          return (
            <Pressable
              key={p.userId}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
              style={({ pressed }) => [styles.row, current && styles.rowCurrent, pressed && styles.pressed]}
              onPress={() =>
                run(async () => {
                  await switchTo(p.userId);
                  router.dismissTo("/");
                })
              }
            >
              <Avatar name={p.nickname} color={p.color} size={36} />
              <Text style={styles.name} numberOfLines={1}>
                {p.nickname}
              </Text>
              <Text style={[styles.tag, current && styles.tagCurrent]}>{current ? "Playing" : "Switch"}</Text>
            </Pressable>
          );
        })}
      </Section>
      <Section title="Log in as another player">
        <RegisterForm buttonTitle="Log in" onDone={() => router.dismissTo("/")} />
        <Muted>Type a username to log in. If nobody has it yet, a new player is created.</Muted>
      </Section>
      {profile ? (
        <Button title={`Forget ${profile.nickname} on this phone`} kind="ghost" busy={busy} onPress={() => run(() => forget(profile.userId))} />
      ) : null}
      <Muted style={styles.backend}>Backend: {CONVEX_URL}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 64,
    borderRadius: radii.row,
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
  },
  rowCurrent: { backgroundColor: colors.cream },
  pressed: { transform: [{ scale: 0.985 }] },
  name: { flex: 1, fontFamily: fonts.heavy, fontSize: 16, color: colors.ink },
  tag: { fontFamily: fonts.heavy, fontSize: 14, color: colors.muted },
  tagCurrent: { color: colors.ink },
  backend: { fontSize: 12, textAlign: "center" },
});
