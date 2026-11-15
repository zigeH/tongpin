import { Link, Stack, router } from "expo-router";
import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, type BoxView, type InboxItem } from "../lib/backend";
import { useSession } from "../lib/session";
import { STATUS_TEXT } from "../lib/status";
import { Button, Loading, Muted, Screen, Section } from "../components/ui";
import { RegisterForm } from "../features/RegisterForm";
import { ErrorBoundary as RouteErrorBoundary } from "../features/RouteError";

export const ErrorBoundary = RouteErrorBoundary;

const ACTION_TEXT: Record<InboxItem["action"], string> = {
  claim: "去认领",
  edit: "去改造",
  open: "去开盒",
};

export default function InboxScreen() {
  const { profile } = useSession();
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" style={styles.headerLink}>
              {profile ? profile.nickname : "设置"}
            </Link>
          ),
        }}
      />
      {profile ? (
        <Inbox userId={profile.userId} />
      ) : (
        <Screen>
          <Section title="先起个昵称">
            <RegisterForm />
          </Section>
        </Screen>
      )}
    </>
  );
}

function Inbox({ userId }: { userId: BoxView["senderId"] }) {
  const inbox = useQuery(api.boxes.inbox, { userId });
  return (
    <Screen>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="寄一个盲盒" onPress={() => router.push("/new")} />
        </View>
        <View style={styles.flex}>
          <Button title="输入盒子码" kind="secondary" onPress={() => router.push("/claim")} />
        </View>
      </View>
      {inbox === undefined ? (
        <Loading />
      ) : (
        <>
          <Section title="收到的">
            {inbox.received.length === 0 ? <Muted>还没有</Muted> : null}
            {inbox.received.map((box) => (
              <BoxRow
                key={box._id}
                box={box}
                who={box.action === "open" ? `${box.receiverNickname ?? "对方"} 改好寄回` : `来自 ${box.senderNickname}`}
                action={ACTION_TEXT[box.action]}
              />
            ))}
          </Section>
          <Section title="寄出的">
            {inbox.sent.length === 0 ? <Muted>还没有</Muted> : null}
            {inbox.sent.map((box) => (
              <BoxRow key={box._id} box={box} who={box.receiverNickname ? `给 ${box.receiverNickname}` : "还没人认领"} />
            ))}
          </Section>
        </>
      )}
    </Screen>
  );
}

function BoxRow({ box, who, action }: { box: BoxView; who: string; action?: string }) {
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/box/${box._id}`)}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>
          盒子 {box.code} · {who}
        </Text>
        <Muted>{STATUS_TEXT[box.status]}</Muted>
      </View>
      {action ? <Text style={styles.rowAction}>{action} ›</Text> : <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerLink: { fontSize: 16, color: "#007aff" },
  actions: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    gap: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowAction: { color: "#007aff", fontWeight: "600" },
  chevron: { color: "#bbb", fontSize: 20 },
});
