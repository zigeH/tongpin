import { useMutation } from "convex/react";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Rect } from "react-native-svg";
import { api } from "../../lib/backend";
import { pickImage, toUploadableJpeg, type LocalImage } from "../../lib/images";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { Button } from "../../components/ui";
import { Header, TrottingBobo } from "./parts";
import { colors, fonts, stroke, useScale } from "../../theme";

// A：拍照 / 相册选图 → 转 JPEG（长边 ≤ 1536）→ 上传 → boxes.create → 去等待页
export function PhotoScreen() {
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const { userId } = useProfile();
  const create = useMutation(api.boxes.create);
  const { uploadUri } = useUpload();
  const { busy, run } = useTask();
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  const pick = (source: "camera" | "library") =>
    run(async () => {
      const picked = await pickImage(source);
      if (picked) setPhoto(picked);
    });

  const send = () =>
    run(async () => {
      if (!photo) return;
      const jpeg = await toUploadableJpeg(photo);
      const photoStorageId = await uploadUri(jpeg.uri, "image/jpeg");
      const { boxId } = await create({ userId, photoStorageId });
      router.replace(`/box/${boxId}`);
    });

  return (
    <View style={[styles.screen, { paddingHorizontal: s(18), paddingBottom: Math.max(insets.bottom, s(20)) }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Snap a moment" left="Cancel" onLeft={() => router.back()} />
      <Text style={[styles.hint, { fontSize: s(15), marginTop: s(6) }]}>
        Pick one thing you love. We'll cut it out and turn it into 3D.
      </Text>

      <View
        style={[styles.frame, { marginTop: s(14), borderRadius: s(24) }]}
        onLayout={(e) => setFrame(e.nativeEvent.layout)}
      >
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel="Your photo" />
            <View style={[styles.frameBorder, { borderRadius: s(24) }]} pointerEvents="none" />
          </>
        ) : (
          <Pressable style={styles.empty} onPress={() => pick("camera")} disabled={busy} accessibilityRole="button" accessibilityLabel="Take a photo">
            {frame.width > 0 ? (
              <Svg width={frame.width} height={frame.height} style={StyleSheet.absoluteFill} pointerEvents="none">
                <Rect
                  x={stroke.width / 2}
                  y={stroke.width / 2}
                  width={frame.width - stroke.width}
                  height={frame.height - stroke.width}
                  rx={s(24)}
                  stroke={colors.ink}
                  strokeWidth={stroke.width}
                  strokeDasharray="10 8"
                  fill={colors.cream}
                />
              </Svg>
            ) : null}
            <Text style={[styles.plus, { fontSize: s(56) }]}>+</Text>
            <Text style={[styles.emptyTitle, { fontSize: s(26) }]}>tap to snap</Text>
            <Text style={[styles.emptySub, { fontSize: s(13) }]}>a mug, a plant, your favorite chair…</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.row, { marginTop: s(14), gap: s(10) }]}>
        <Button kind="secondary" title={photo ? "Retake" : "Camera"} onPress={() => pick("camera")} disabled={busy} style={styles.flex} />
        <Button kind="secondary" title="Library" onPress={() => pick("library")} disabled={busy} style={styles.flex} />
      </View>

      <View style={[styles.footer, { marginTop: s(16), gap: s(4) }]}>
        <TrottingBobo size={s(96)} style={{ marginLeft: -s(8) }} />
        <Button title={busy && photo ? "Packing…" : "Use this photo"} onPress={send} busy={busy && !!photo} disabled={!photo} style={styles.grow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.paper },
  hint: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
  frame: { flex: 1, overflow: "hidden" },
  frameBorder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: stroke.width, borderColor: colors.ink },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  plus: { fontFamily: fonts.bold, color: colors.ink, lineHeight: 60 },
  emptyTitle: { fontFamily: fonts.hand, color: colors.ink },
  emptySub: { fontFamily: fonts.bold, color: colors.muted },
  row: { flexDirection: "row" },
  flex: { flex: 1 },
  footer: { flexDirection: "row", alignItems: "center" },
});
