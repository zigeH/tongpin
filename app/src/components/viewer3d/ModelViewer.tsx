import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { CameraPose } from "../../lib/backend";
import { colors, fonts } from "../../theme";
import { viewerHtml } from "./viewerHtml";

export type Snapshot = { pngBase64: string; pose: CameraPose };

// A sticker composited over the captured frame: center x/y as fractions of the viewer, side as a fraction of its width.
export type CaptureOverlay = { svg: string; x: number; y: number; size: number };

export type ModelViewerHandle = {
  // Freeze: transparent PNG of the current view (plus any overlays drawn on top) and the camera pose.
  capture: (overlays?: CaptureOverlay[]) => Promise<Snapshot>;
};

type Message =
  | { type: "loaded" }
  | { type: "progress"; ratio: number }
  | { type: "error"; message: string }
  | { type: "captureError"; message: string }
  | { type: "snapshot"; dataUrl: string; pose: CameraPose };

type Props = {
  modelUrl: string;
  ref?: Ref<ModelViewerHandle>;
  style?: StyleProp<ViewStyle>;
  // Slow turntable spin; pauses while the user drags and resumes 2.5s after.
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  interactive?: boolean;
  initialPose?: CameraPose;
  onLoaded?: () => void;
  // Built-in loading overlay (bouncing dots + label). Pass false to draw your own.
  showLoading?: boolean;
  loadingLabel?: string;
};

const PNG_PREFIX = "data:image/png;base64,";
const DOT_COLORS = [colors.orange, colors.sun, colors.croc];

export function ModelViewer({
  modelUrl,
  ref,
  style,
  autoRotate = false,
  autoRotateSpeed = 1.6,
  interactive = true,
  initialPose,
  onLoaded,
  showLoading = true,
  loadingLabel = "Loading 3D…",
}: Props) {
  const webView = useRef<WebView<object>>(null);
  const pending = useRef<{ resolve: (s: Snapshot) => void; reject: (e: Error) => void } | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const poseKey = initialPose ? JSON.stringify(initialPose) : "";
  const html = useMemo(
    () => viewerHtml(modelUrl, { autoRotate, autoRotateSpeed, interactive, initialPose }),
    // autoRotate changes go through setAutoRotate below instead of reloading the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelUrl, autoRotateSpeed, interactive, poseKey],
  );

  useEffect(() => setState("loading"), [html, attempt]);

  useEffect(() => {
    webView.current?.injectJavaScript(`window.setAutoRotate && window.setAutoRotate(${autoRotate}); true;`);
  }, [autoRotate]);

  useImperativeHandle(ref, () => ({
    capture: (overlays = []) =>
      new Promise<Snapshot>((resolve, reject) => {
        if (state !== "loaded") {
          reject(new Error("The 3D model is still loading."));
          return;
        }
        pending.current = { resolve, reject };
        webView.current?.injectJavaScript(`window.capture && window.capture(${JSON.stringify(overlays)}); true;`);
      }),
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    const message = JSON.parse(event.nativeEvent.data) as Message;
    if (message.type === "loaded") {
      setState("loaded");
      onLoaded?.();
    }
    if (message.type === "error") {
      setState("error");
      pending.current?.reject(new Error(message.message));
      pending.current = null;
    }
    if (message.type === "captureError") {
      pending.current?.reject(new Error(message.message));
      pending.current = null;
    }
    if (message.type === "snapshot") {
      if (!message.dataUrl.startsWith(PNG_PREFIX)) {
        pending.current?.reject(new Error("The frozen frame is not a PNG."));
      } else {
        pending.current?.resolve({ pngBase64: message.dataUrl.slice(PNG_PREFIX.length), pose: message.pose });
      }
      pending.current = null;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView<object>
        key={attempt}
        ref={webView}
        source={{ html, baseUrl: "https://localhost/" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        onError={() => setState("error")}
        scrollEnabled={false}
        bounces={false}
        style={[styles.webView, state !== "loaded" && styles.hidden]}
      />
      {state === "loading" && showLoading ? <LoadingDots label={loadingLabel} /> : null}
      {state === "error" ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>3D got lost on the way</Text>
          <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function LoadingDots({ label }: { label: string }) {
  const values = useRef(DOT_COLORS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const step = 160;
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * step),
          Animated.timing(value, { toValue: -10, duration: step, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: step, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((values.length - i) * step + step),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);
  return (
    <View style={styles.overlay} pointerEvents="none" accessibilityLabel="Loading 3D">
      <View style={styles.dots}>
        {DOT_COLORS.map((color, i) => (
          <Animated.View key={color} style={[styles.dot, { backgroundColor: color, transform: [{ translateY: values[i] }] }]} />
        ))}
      </View>
      <Text style={styles.overlayText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 320, overflow: "hidden", backgroundColor: "transparent" },
  webView: { flex: 1, backgroundColor: "transparent" },
  hidden: { opacity: 0 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 10 },
  dots: { flexDirection: "row", gap: 8, height: 24, alignItems: "flex-end" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink },
  overlayText: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  overlayTitle: { fontFamily: fonts.heavy, fontSize: 15, color: colors.ink },
  retry: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white },
  retryText: { fontFamily: fonts.heavy, fontSize: 13, color: colors.ink },
});
