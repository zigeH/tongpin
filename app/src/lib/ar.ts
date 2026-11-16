import { Alert, Linking, Platform } from "react-native";

// System AR: iOS AR Quick Look (Safari opens the usdz straight into AR), Android Scene Viewer.
export function openRealAR(modelUrl: string | undefined, usdzUrl: string | undefined) {
  if (Platform.OS === "ios") {
    if (!usdzUrl) {
      Alert.alert("Real AR isn't ready", "This model has no USDZ file yet.");
      return;
    }
    Linking.openURL(usdzUrl);
  } else if (modelUrl) {
    const intent = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(modelUrl)};end;`;
    Linking.openURL(intent);
  }
}
