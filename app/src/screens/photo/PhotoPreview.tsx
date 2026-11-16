import { useMutation } from "convex/react";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { colors, fonts, roughRect, stroke, useScale } from "../../theme";
import { BodyText, Button, HandText } from "../../components/ui";
import { Enter, Sparkle } from "../remix/parts";

const JPEG_PREFIX = "data:image/jpeg;base64,";

// 拍完后的预览：重拍 / 存相册 / 分享 / 放进盒子（对方在结果页能看到）。
export function PhotoPreview({
  box,
  jpeg,
  onRetake,
  onDone,
}: {
  box: BoxView;
  jpeg: string;
  onRetake: () => void;
  onDone: () => void;
}) {
  const { userId } = useProfile();
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const saveShot = useMutation(api.boxes.saveShot);
  const { uploadBase64 } = useUpload();
  const keep = useTask();
  const save = useTask();
  const share = useTask();
  const [kept, setKept] = useState(false);
  const [savedToPhotos, setSavedToPhotos] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const base64 = jpeg.slice(JPEG_PREFIX.length);
  const friend = (userId === box.senderId ? box.receiverNickname : box.senderNickname) || "your friend";

  useEffect(() => () => file?.delete(), [file]);

  const localFile = async () => {
    if (file) return file;
    const f = new File(Paths.cache, `tongpin-photo-${Date.now()}.jpg`);
    await f.write(base64, { encoding: "base64" });
    setFile(f);
    return f;
  };

  const putInBox = () =>
    keep.run(async () => {
      const storageId = await uploadBase64(base64, "image/jpeg");
      await saveShot({ boxId: box._id, userId, imageStorageId: storageId });
      setKept(true);
    });

  const saveToPhotos = () =>
    save.run(async () => {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
      if (!permission.granted) {
        Alert.alert("Can't save yet", "Allow photo access in Settings to save your photo.");
        return;
      }
      await MediaLibrary.Asset.create((await localFile()).uri);
      setSavedToPhotos(true);
    });

  const shareIt = () =>
    share.run(async () => {
      await Sharing.shareAsync((await localFile()).uri, { mimeType: "image/jpeg", UTI: "public.jpeg", dialogTitle: "Share your photo" });
    });

  const photoWidth = s(300);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <Enter style={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={onRetake} hitSlop={10} style={styles.topLink}>
            <Text style={styles.topLinkText}>Retake</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDone} hitSlop={10} style={styles.topLink}>
            <Text style={styles.topLinkText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.titleWrap}>
          <HandText size={38} accessibilityRole="header" style={styles.center}>
            {kept ? "In the box!" : "Say cheese!"}
          </HandText>
          <BodyText size={15} color={colors.muted} style={styles.center}>
            {kept ? `${friend} will see it with the remix.` : "You and the remix, together."}
          </BodyText>
        </View>

        <View style={styles.stage}>
          <View style={[styles.polaroid, { width: photoWidth + 20, transform: [{ rotate: "-2.5deg" }] }]}>
            <Image source={{ uri: jpeg }} style={[styles.photo, { width: photoWidth, height: photoWidth * 1.3 }]} resizeMode="cover" accessibilityLabel="Your photo with the remix" />
            <Text style={styles.caption} numberOfLines={1}>
              {box.prompt ? `me + "${box.prompt}"` : "me + the remix"}
            </Text>
          </View>
          <Sparkle size={30} color={colors.sun} style={styles.sparkleA} />
          <Sparkle size={22} color={colors.orange} style={styles.sparkleB} />
        </View>

        <View style={styles.actions}>
          <RoundAction label={savedToPhotos ? "Saved" : "Save"} busy={save.busy} done={savedToPhotos} onPress={saveToPhotos} icon="save" />
          <RoundAction label="Share" busy={share.busy} onPress={shareIt} icon="share" />
          <RoundAction label="Retake" onPress={onRetake} icon="retake" />
        </View>

        {kept ? (
          <Button kind="secondary" title="Done" onPress={onDone} />
        ) : (
          <Button title={`Put it in the box for ${friend}`} busy={keep.busy} onPress={putInBox} />
        )}
      </Enter>
    </View>
  );
}

const ICONS = {
  save: "M14 5.5c-.2 5.4-.1 10.6.1 15.6M8.6 15.8c1.9 2 3.6 3.7 5.5 5.4 1.8-1.8 3.6-3.6 5.4-5.6M6.2 22.8c5.2.3 10.4.2 15.6-.1",
  share: "M14 20.6c-.1-5.3-.2-10.4 0-15.2M8.8 10c1.8-1.8 3.4-3.4 5.2-4.9 1.9 1.6 3.6 3.2 5.3 5M8.2 14.6H6.6c-.2 2.8-.1 5.4.2 7.9 5.1.3 10.2.2 14.6-.1.2-2.6.2-5.2 0-7.8h-1.6",
  retake: "M21.6 11.2c-1.4-3.4-4.6-5.2-8-4.8-4.1.6-6.8 4.1-6.3 8.1.5 3.8 3.8 6.6 7.8 6.3 2.6-.2 4.6-1.6 5.8-3.6M22.2 5.8c0 1.9-.1 3.8-.4 5.7-1.9.1-3.7 0-5.6-.2",
  done: "M7.4 14.6c1.9 1.9 3.6 3.6 5.2 5.4 2.9-4.2 5.6-8 8.6-11.6",
} as const;

function RoundAction({ label, icon, onPress, busy, done }: { label: string; icon: keyof typeof ICONS; onPress: () => void; busy?: boolean; done?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.action, (pressed || busy) && styles.pressed]}
    >
      <Svg width={60} height={60}>
        <Path d={roughRect(60, 60, 30, { seed: label.length * 3 + 1, inset: 2.5 })} fill={done ? colors.croc : colors.white} stroke={colors.ink} strokeWidth={stroke.width} />
        <Path transform="translate(16 16)" d={ICONS[done ? "done" : icon]} fill="none" stroke={colors.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.paper, paddingHorizontal: 22 },
  content: { gap: 14 },
  topBar: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topLink: { height: 44, justifyContent: "center" },
  topLinkText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  titleWrap: { alignItems: "center", gap: 6 },
  center: { textAlign: "center" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  polaroid: {
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 10,
    paddingBottom: 6,
    maxHeight: "100%",
  },
  photo: { borderRadius: 2, backgroundColor: colors.cream, maxHeight: "92%" },
  caption: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 30, color: colors.ink, textAlign: "center" },
  sparkleA: { position: "absolute", right: 8, top: 4 },
  sparkleB: { position: "absolute", left: 10, bottom: 30 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 28 },
  action: { alignItems: "center", gap: 4 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  actionLabel: { fontFamily: fonts.heavy, fontSize: 13, color: colors.ink },
});
