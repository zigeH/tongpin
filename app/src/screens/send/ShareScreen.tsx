import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModelViewer } from "../../components/ModelViewer";
import { api, type BoxView, type Id } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useTask } from "../../lib/useTask";
import { FriendPicker } from "./FriendPicker";
import { Avatar, Card, Header, Pill, PrimaryButton, StageBackdrop, TrottingBobo } from "./parts";
import { SentScreen } from "./SentScreen";
import { colors, fonts, STROKE, useScale } from "./theme";

export function inviteMessage(code: string) {
  return `I packed a little 3D moment for you! Open 一起搭 and enter box code ${code} to remix it.`;
}

// 设计稿 2-send：3D 预览 + caption（senderNote）+ 好友多选（users.friends）+ Invite（系统分享盒子码）→ boxes.share
export function ShareScreen({ box }: { box: BoxView }) {
  const s = useScale();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const friends = useQuery(api.users.friends, { userId: profile.userId });
  const share = useMutation(api.boxes.share);
  const sending = useTask();
  const inviting = useTask();
  const [caption, setCaption] = useState(box.senderNote ?? "");
  const [selected, setSelected] = useState<Set<Id<"users">>>(new Set());
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [sentTo, setSentTo] = useState<string[] | null>(null);

  const note = () => caption.trim() || undefined;

  const toggle = (id: Id<"users">) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Invite 分享的是母盒的码：还没 share 过就先 share 一次（空名单），让这个码变成人人可领的母盒。
  const invite = () =>
    inviting.run(async () => {
      if (!box.shared) await share({ boxId: box._id, userId: profile.userId, receiverIds: [], senderNote: note() });
      await Share.share({ message: inviteMessage(box.code) });
    });

  const send = () =>
    sending.run(async () => {
      const receiverIds = [...selected];
      await share({ boxId: box._id, userId: profile.userId, receiverIds, senderNote: note() });
      setSentTo((friends ?? []).filter((f) => selected.has(f.userId)).map((f) => f.nickname));
    });

  if (sentTo) return <SentScreen box={box} sentTo={sentTo} />;

  return (
    <View style={[styles.screen, { paddingHorizontal: s(18), paddingBottom: Math.max(insets.bottom, s(20)) }]}>
      <Header title="Share your moment" left="Cancel" onLeft={() => router.dismissTo("/")} />

      <Card style={{ marginTop: s(10) }}>
        <View style={[styles.cardHead, { paddingHorizontal: s(14), paddingVertical: s(10), gap: s(10) }]}>
          <Avatar name={profile.nickname} color={box.senderColor} />
          <View style={styles.flex}>
            <Text style={[styles.nick, { fontSize: s(15) }]}>{profile.nickname}</Text>
            <Text style={[styles.sub, { fontSize: s(12) }]}>box {box.code}</Text>
          </View>
          <Pill label="3D" background={colors.sun} />
        </View>
        <View style={[styles.stage, { height: s(300) }]} onLayout={(e) => setStage(e.nativeEvent.layout)}>
          {stage.width > 0 ? <StageBackdrop width={stage.width} height={stage.height} /> : null}
          {box.modelUrl ? (
            <ModelViewer modelUrl={box.modelUrl} style={styles.viewer} />
          ) : (
            <Image source={{ uri: box.cutoutUrl ?? box.photoUrl }} resizeMode="contain" style={styles.cutout} />
          )}
          <Pill label="Drag to spin" background="rgba(255,255,255,0.9)" style={[styles.drag, { left: s(12), bottom: s(12) }]} />
          <View style={[styles.polaroid, { right: s(12), bottom: s(10), width: s(56), padding: s(4), paddingBottom: s(14) }]}>
            <Image source={{ uri: box.photoUrl }} style={{ height: s(48), borderRadius: 2, backgroundColor: colors.stageShadow }} />
            <Text style={[styles.polaroidText, { fontSize: s(9) }]}>photo</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: s(14), paddingTop: s(10), paddingBottom: s(12) }}>
          <TextInput
            accessibilityLabel="Caption"
            value={caption}
            onChangeText={setCaption}
            placeholder="say something about it…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={200}
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            style={[styles.caption, { fontSize: s(24), lineHeight: s(26.4), minHeight: s(52.8) }]}
          />
        </View>
      </Card>

      <View style={{ marginTop: s(14), gap: s(8) }}>
        <Text style={[styles.label, { fontSize: s(13) }]}>Share with friends · each one can remix it</Text>
        <FriendPicker friends={friends ?? []} selected={selected} onToggle={toggle} onInvite={invite} inviteBusy={inviting.busy} />
        {friends && friends.length === 0 ? (
          <Text style={[styles.sub, { fontSize: s(12) }]}>No friends yet. Invite someone with your box code!</Text>
        ) : null}
      </View>

      <View style={styles.spacer} />
      <View style={[styles.footer, { gap: s(4) }]}>
        <TrottingBobo size={s(96)} style={{ marginLeft: -s(8) }} />
        <PrimaryButton title="Share moment" onPress={send} busy={sending.busy} disabled={selected.size === 0 || inviting.busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  nick: { fontFamily: fonts.heavy, color: colors.ink },
  sub: { fontFamily: fonts.body, color: colors.muted },
  stage: {
    backgroundColor: colors.stage,
    borderTopWidth: STROKE,
    borderBottomWidth: STROKE,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  viewer: { flex: 1, height: undefined, borderRadius: 0, backgroundColor: "transparent" },
  cutout: { position: "absolute", left: "20%", right: "20%", top: "12%", bottom: "12%" },
  drag: { position: "absolute" },
  polaroid: {
    position: "absolute",
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 4,
    transform: [{ rotate: "5deg" }],
  },
  polaroidText: { position: "absolute", left: 0, right: 0, bottom: 1, textAlign: "center", fontFamily: fonts.heavy, color: colors.ink },
  caption: { fontFamily: fonts.hand, color: colors.ink, padding: 0, textAlignVertical: "top" },
  label: { fontFamily: fonts.heavy, color: colors.muted },
  spacer: { flex: 1, minHeight: 8 },
  footer: { flexDirection: "row", alignItems: "center" },
});
