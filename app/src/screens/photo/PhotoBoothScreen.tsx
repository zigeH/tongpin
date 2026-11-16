import { Stack, router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { BoxView } from "../../lib/backend";
import { openRealAR } from "../../lib/ar";
import { photoBoothHtml, type CameraFacing } from "../../components/viewer3d/photoBoothHtml";
import { colors as C, fonts as F, roughCircle, roughRect, stroke } from "../../theme";
import { PhotoPreview } from "./PhotoPreview";

// 和 3D 合影：相机画面 + 可拖动/缩放/旋转的 3D，拍照合成后进预览（重拍 / 存相册 / 分享 / 放进盒子）。
// 默认前置镜头（自拍和改后的 3D 合影），可切后置；右上角"Real AR"打开系统真 AR（iOS AR Quick Look / Android Scene Viewer）。
type Msg =
  | { type: "loaded" }
  | { type: "camera"; ok: boolean; message?: string }
  | { type: "shot"; jpeg: string }
  | { type: "error"; message: string };

export function PhotoBoothScreen({ box }: { box: BoxView }) {
  const insets = useSafeAreaInsets();
  const web = useRef<WebView<object>>(null);

  // 改造过就和改后的 3D 合影，否则用原版
  const modelUrl = box.editedModelUrl ?? box.modelUrl;
  const usdzUrl = box.editedModelUrl ? box.editedUsdzUrl : box.modelUsdzUrl;
  const html = useMemo(() => (modelUrl ? photoBoothHtml(modelUrl) : ""), [modelUrl]);

  const [loaded, setLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [fur, setFur] = useState(true);
  const [facing, setFacing] = useState<CameraFacing>("user");

  const onMessage = (e: WebViewMessageEvent) => {
    let m: Msg;
    try { m = JSON.parse(e.nativeEvent.data) as Msg; } catch { return; }
    if (m.type === "loaded") setLoaded(true);
    if (m.type === "camera") setCameraError(m.ok ? null : (m.message ?? "Camera unavailable"));
    if (m.type === "shot") setShot(m.jpeg);
    if (m.type === "error") console.warn("[photo-booth]", m.message);
  };

  const js = (code: string) => web.current?.injectJavaScript(`${code}; true;`);

  const flip = () => {
    const next = facing === "user" ? "environment" : "user";
    js(`window.setFacing(${JSON.stringify(next)})`);
    setFacing(next);
  };

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
          <ActivityIndicator color={C.paper} />
          <Text style={styles.msg}>Bringing the remix over…</Text>
        </View>
      ) : null}
      {cameraError ? (
        <View style={[styles.banner, { top: insets.top + 110 }]} pointerEvents="none">
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
      {cameraError ? null : (
        <View style={[styles.hintWrap, { top: insets.top + 66 }]} pointerEvents="none">
          <Text style={styles.hintTitle}>Strike a pose with it!</Text>
          <Text style={styles.hint}>Drag to place · pinch to resize & turn</Text>
        </View>
      )}

      <View style={[styles.shutterRow, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <Pill label="Reset" onPress={() => js("window.resetModel()")} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={!loaded}
          onPress={() => js("window.shoot()")}
          style={({ pressed }) => [(!loaded || pressed) && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}
        >
          <Svg width={84} height={84}>
            <Path d={roughCircle(42, 42, 38, { seed: 5 })} fill={C.white} stroke={C.ink} strokeWidth={stroke.icon} />
            <Path d={roughCircle(42, 42, 28, { seed: 9 })} fill={C.orange} stroke={C.ink} strokeWidth={stroke.width} />
          </Svg>
        </Pressable>
        <Pill label={facing === "user" ? "Back cam" : "Selfie"} onPress={flip} accessibilityLabel="Switch camera" />
      </View>

      {shot ? <PhotoPreview box={box} jpeg={shot} onRetake={() => setShot(null)} onDone={() => router.back()} /> : null}
    </View>
  );
}

function Pill({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const [w, setW] = useState(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}
    >
      {w ? (
        <Svg width={w} height={44} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={roughRect(w, 44, 22, { seed: label.length + 2, inset: 2 })} fill={C.paper} stroke={C.ink} strokeWidth={stroke.width} />
        </Svg>
      ) : null}
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: StyleSheet.absoluteFill,
  center: { alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.ink },
  msg: { color: C.paper, fontSize: 16, fontFamily: F.bold },
  row: { flexDirection: "row", gap: 8 },
  topRow: { position: "absolute", left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  hintWrap: { position: "absolute", alignSelf: "center", alignItems: "center" },
  hintTitle: { color: C.white, fontSize: 30, lineHeight: 32, fontFamily: F.hand, textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 5 },
  hint: { color: C.white, fontSize: 14, fontFamily: F.bold, textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 4 },
  banner: { position: "absolute", left: 20, right: 20, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: C.ink, backgroundColor: C.cream },
  bannerText: { color: C.ink, fontSize: 13, fontFamily: F.bold },
  shutterRow: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { minWidth: 76, height: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  pillText: { color: C.ink, fontSize: 15, fontFamily: F.heavy },
});
