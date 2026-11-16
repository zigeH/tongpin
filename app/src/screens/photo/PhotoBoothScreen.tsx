import { useMutation } from "convex/react";
import { Stack, router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { openRealAR } from "../../lib/ar";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { photoBoothHtml } from "../../components/viewer3d/photoBoothHtml";
import { colors as C, fonts as F } from "../../theme";

// 开盒合影：相机画面 + 可拖动的 3D，拍照合成后存回盒子（做法 1）。
// 右上角"Real AR"打开系统真 AR（做法 2：iOS AR Quick Look / Android Scene Viewer），照片进系统相册。
type Msg =
  | { type: "loaded" }
  | { type: "camera"; ok: boolean; message?: string }
  | { type: "shot"; jpeg: string }
  | { type: "error"; message: string };

const JPEG_PREFIX = "data:image/jpeg;base64,";

export function PhotoBoothScreen({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView<object>>(null);
  const saveShot = useMutation(api.boxes.saveShot);
  const { uploadBase64 } = useUpload();
  const { busy, run } = useTask();

  // 改造过就和改后的 3D 合影，否则用原版
  const modelUrl = box.editedModelUrl ?? box.modelUrl;
  const usdzUrl = box.editedModelUrl ? box.editedUsdzUrl : box.modelUsdzUrl;
  const html = useMemo(() => (modelUrl ? photoBoothHtml(modelUrl) : ""), [modelUrl]);

  const [loaded, setLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [fur, setFur] = useState(true);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: Msg;
    try { m = JSON.parse(e.nativeEvent.data) as Msg; } catch { return; }
    if (m.type === "loaded") setLoaded(true);
    if (m.type === "camera" && !m.ok) setCameraError(m.message ?? "Camera unavailable");
    if (m.type === "shot") setShot(m.jpeg);
    if (m.type === "error") console.warn("[photo-booth]", m.message);
  };

  const js = (code: string) => web.current?.injectJavaScript(`${code}; true;`);


  const keep = () =>
    run(async () => {
      if (!shot) return;
      const storageId = await uploadBase64(shot.slice(JPEG_PREFIX.length), "image/jpeg");
      await saveShot({ boxId: box._id, userId, imageStorageId: storageId });
      setShot(null);
      router.back();
    });

  if (!modelUrl) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.msg}>This box has no 3D yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false }} />
      <WebView<object>
        ref={web}
        source={{ html, baseUrl: "https://localhost/" }}
        originWhitelist={["*"]}
        style={styles.fill}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        // 相机：iOS WKWebView 的 getUserMedia，需要内联播放 + 授权
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
      />

      {!loaded ? (
        <View style={[styles.fill, styles.center]} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {cameraError ? (
        <View style={[styles.banner, { top: insets.top + 64 }]} pointerEvents="none">
          <Text style={styles.bannerText}>Camera unavailable: {cameraError}</Text>
        </View>
      ) : null}

      <View style={[styles.topRow, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pill label="Close" onPress={() => router.back()} />
        <View style={styles.row}>
          <Pill label={fur ? "Fuzz on" : "Fuzz off"} onPress={() => { js(`window.setFur(${!fur})`); setFur(!fur); }} />
          <Pill label="Real AR" onPress={() => openRealAR(modelUrl, usdzUrl)} />
        </View>
      </View>
      <Text style={[styles.hint, { top: insets.top + 64 }]} pointerEvents="none">
        {cameraError ? "" : "Drag to place · pinch to resize & turn"}
      </Text>

      <View style={[styles.shutterRow, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <Pill label="Reset" onPress={() => js("window.resetModel()")} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={!loaded}
          onPress={() => js("window.shoot()")}
          style={({ pressed }) => [styles.shutter, (!loaded || pressed) && { opacity: 0.6 }]}
        />
        <View style={{ width: 72 }} />
      </View>

      {shot ? (
        <View style={[styles.fill, styles.preview]}>
          <Image source={{ uri: shot }} style={styles.fill} resizeMode="cover" />
          <View style={[styles.shutterRow, { bottom: insets.bottom + 24 }]}>
            <Pill label="Retake" onPress={() => setShot(null)} />
            <Pill label={busy ? "Saving…" : "Keep in the box"} primary onPress={keep} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Pill({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pill, primary && styles.pillPrimary, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.pillText, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
  center: { alignItems: "center", justifyContent: "center", backgroundColor: "#2a1c12" },
  msg: { color: "#f3e2cc", fontSize: 16 },
  row: { flexDirection: "row", gap: 8 },
  topRow: { position: "absolute", left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  hint: { position: "absolute", alignSelf: "center", color: "#fff", fontSize: 14, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  banner: { position: "absolute", left: 20, right: 20, padding: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)" },
  bannerText: { color: "#fff", fontSize: 13 },
  shutterRow: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#fff", borderWidth: 6, borderColor: C.orange },
  preview: { backgroundColor: "#000" },
  pill: { minWidth: 72, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: "rgba(255,250,242,0.92)", alignItems: "center", justifyContent: "center" },
  pillPrimary: { backgroundColor: C.orange },
  pillText: { color: "#4a2a14", fontSize: 15, fontFamily: F.bold },
});
