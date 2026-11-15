import { useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { CameraPose } from "../lib/backend";
import { viewerHtml } from "./viewerHtml";

export type Snapshot = { pngBase64: string; pose: CameraPose };

export type ModelViewerHandle = {
  // 定格：导出当前视角的透明背景 PNG 和相机位姿
  capture: () => Promise<Snapshot>;
};

type Message =
  | { type: "loaded" }
  | { type: "error"; message: string }
  | { type: "snapshot"; dataUrl: string; pose: CameraPose };

type Props = {
  modelUrl: string;
  ref?: Ref<ModelViewerHandle>;
  style?: StyleProp<ViewStyle>;
};

const PNG_PREFIX = "data:image/png;base64,";

export function ModelViewer({ modelUrl, ref, style }: Props) {
  const webView = useRef<WebView<object>>(null);
  const pending = useRef<{ resolve: (s: Snapshot) => void; reject: (e: Error) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const html = useMemo(() => viewerHtml(modelUrl), [modelUrl]);

  useImperativeHandle(ref, () => ({
    capture: () =>
      new Promise<Snapshot>((resolve, reject) => {
        pending.current = { resolve, reject };
        webView.current?.injectJavaScript("window.capture && window.capture(); true;");
      }),
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    const message = JSON.parse(event.nativeEvent.data) as Message;
    if (message.type === "loaded") setError(null);
    if (message.type === "error") {
      setError(message.message);
      pending.current?.reject(new Error(message.message));
      pending.current = null;
    }
    if (message.type === "snapshot") {
      if (!message.dataUrl.startsWith(PNG_PREFIX)) {
        pending.current?.reject(new Error("定格图不是 PNG"));
      } else {
        pending.current?.resolve({ pngBase64: message.dataUrl.slice(PNG_PREFIX.length), pose: message.pose });
      }
      pending.current = null;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView<object>
        ref={webView}
        source={{ html, baseUrl: "https://localhost/" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        style={styles.webView}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 320, borderRadius: 12, overflow: "hidden", backgroundColor: "#eef1f5" },
  webView: { flex: 1, backgroundColor: "transparent" },
  error: { position: "absolute", bottom: 8, left: 8, right: 8, color: "#c0392b", fontSize: 12 },
});
