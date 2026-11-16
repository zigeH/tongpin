import { router } from "expo-router";
import { useQuery } from "convex/react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/backend";
import type { Profile } from "../../lib/session";
import { Avatar, Button, HandText, Loading, PlusIcon } from "../../components/ui";
import { colors, fonts, sizes, useScale } from "../../theme";
import { BoboRoom } from "./BoboRoom";
import { BoxRow } from "./BoxRow";
import { bubbleMessage, toHomeItems, type HomeItem } from "./items";

export function HomeScreen({ profile }: { profile: Profile }) {
  const inbox = useQuery(api.boxes.inbox, { userId: profile.userId });
  const insets = useSafeAreaInsets();
  const { width, height } = useScale();
  const k = Math.min((width - sizes.gutter * 2) / 346, (height / 844) * 1.02, 1.15);
  const items = inbox ? toHomeItems(inbox) : [];
  const open = (item: HomeItem) => {
    if (item.route === "invite") Share.share({ message: `Open my Bobo box! Box code: ${item.code}` });
    else router.push(item.route === "arrived" ? `/arrived/${item.boxId}` : item.route === "photo" ? `/photo/${item.boxId}` : `/box/${item.boxId}`);
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <HandText size={40}>Bobo's boxes</HandText>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Playing as ${profile.nickname}. Switch player`} onPress={() => router.push("/settings")} style={styles.iconHit}>
            <Avatar name={profile.nickname} color={profile.color} size={34} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Send a new box" onPress={() => router.push("/new")} style={styles.iconHit}>
            <PlusIcon />
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: 18 * k, alignItems: "center" }}>
        <BoboRoom k={k} message={bubbleMessage(items.filter((i) => i.needsMe).length)} />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {inbox === undefined ? <Loading /> : null}
        {inbox && items.length === 0 ? <Text style={styles.empty}>No boxes yet. Snap something and send it to a friend!</Text> : null}
        {items.map((item) => (
          <BoxRow key={item.key} color={item.color} title={item.title} subtitle={item.subtitle} trailing={item.trailing} onPress={() => open(item)} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title="Snap something to send" onPress={() => router.push("/new")} />
        <Button title="Got a box code?" kind="ghost" onPress={() => router.push("/claim")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: sizes.gutter },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconHit: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  list: { flex: 1, marginTop: 16 },
  listContent: { gap: 10, paddingBottom: 12 },
  empty: { fontFamily: fonts.bold, fontSize: 15, color: colors.muted, textAlign: "center", paddingVertical: 12 },
  footer: { paddingTop: 8 },
});
