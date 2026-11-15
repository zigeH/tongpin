import { router } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BoxView } from "../../lib/backend";
import { Card, Header, PrimaryButton, SecondaryButton, TrottingBobo } from "./parts";
import { inviteMessage } from "./ShareScreen";
import { colors, fonts, useScale } from "./theme";

const STATUS: Partial<Record<BoxView["status"], string>> = {
  ready: "Waiting for someone to claim it",
  claimed: "is remixing it",
  editing: "is remixing it",
  edited: "is wrapping it up",
};

// 分享成功后的确认页；也用于 A 查看已寄出、正在被改造的盒子。
export function SentScreen({ box, sentTo }: { box: BoxView; sentTo?: string[] }) {
  const s = useScale();
  const insets = useSafeAreaInsets();
  const who = sentTo
    ? sentTo.length > 0
      ? `Sent to ${sentTo.join(", ")}!`
      : "Your box is ready!"
    : box.receiverNickname
      ? `${box.receiverNickname} ${STATUS[box.status] ?? ""}`
      : (STATUS[box.status] ?? "On its way");
  return (
    <View style={[styles.screen, { paddingHorizontal: s(18), paddingBottom: Math.max(insets.bottom, s(20)) }]}>
      <Header title={sentTo ? "Delivered!" : "On its way"} left="Home" onLeft={() => router.dismissTo("/")} />
      <View style={[styles.center, { gap: s(12) }]}>
        <TrottingBobo size={s(160)} />
        <Text style={[styles.big, { fontSize: s(32), lineHeight: s(34) }]}>{who}</Text>
        {sentTo ? (
          <Text style={[styles.sub, { fontSize: s(15) }]}>Each friend gets their own copy to remix.</Text>
        ) : null}
        {box.receiverId ? null : (
          <Card style={{ alignSelf: "stretch", padding: s(16), gap: s(6), alignItems: "center", marginTop: s(8), backgroundColor: colors.cream }}>
            <Text style={[styles.sub, { fontSize: s(13) }]}>Anyone can claim a copy with this code</Text>
            <Text selectable style={[styles.code, { fontSize: s(40), letterSpacing: s(6) }]}>
              {box.code}
            </Text>
          </Card>
        )}
      </View>
      <View style={{ gap: s(10) }}>
        {box.receiverId ? null : (
          <SecondaryButton title="Invite more" onPress={() => Share.share({ message: inviteMessage(box.code) })} />
        )}
        <PrimaryButton title="Done" onPress={() => router.dismissTo("/")} style={{ flexGrow: 0 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  big: { fontFamily: fonts.hand, color: colors.ink, textAlign: "center" },
  sub: { fontFamily: fonts.bold, color: colors.muted, textAlign: "center" },
  code: { fontFamily: fonts.heavy, color: colors.ink },
});
