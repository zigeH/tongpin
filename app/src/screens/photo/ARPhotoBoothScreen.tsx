import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroNode,
  ViroPinchStateTypes,
  ViroQuad,
  ViroRotateStateTypes,
  ViroSpotLight,
  ViroTrackingStateConstants,
  type ViroAmbientLightInfo,
  type ViroTrackingState,
} from "@reactvision/react-viro";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import type { BoxView } from "../../lib/backend";
import { colors as C, fonts as F, roughCircle, roughRect, stroke } from "../../theme";
import { PhotoPreview } from "./PhotoPreview";

// 真 AR 合影（ARKit，ViroReact）：找到地面/桌面，点一下把 3D 放上去，单指拖动、双指缩放和旋转，
// 光照估计 + 投影；快门用 Viro 截图，进同一个拍立得预览。设备不支持 AR 时走 PhotoBoothScreen（WebView）。
type Phase = "starting" | "finding" | "ready" | "placed";

type AppProps = {
  modelUrl: string;
  resetKey: number;
  onPhase: (phase: Phase) => void;
  onModelLoaded: () => void;
  onModelError: () => void;
};

const START_SCALE = 0.3;
const SHOT_EDGE = 1440;

function BoothScene(props: { sceneNavigator: { viroAppProps: AppProps } }) {
  const { modelUrl, resetKey, onPhase, onModelLoaded, onModelError } = props.sceneNavigator.viroAppProps;
  const selector = useRef<ViroARPlaneSelector>(null);
  const planes = useRef(0);
  const [light, setLight] = useState<ViroAmbientLightInfo>({ intensity: 1000, color: "#ffffff" });
  const [scale, setScale] = useState(START_SCALE);
  const [turn, setTurn] = useState(0);
  const base = useRef({ scale: START_SCALE, turn: 0 });

  useEffect(() => {
    if (resetKey === 0) return;
    selector.current?.reset();
    base.current = { scale: START_SCALE, turn: 0 };
    setScale(START_SCALE);
    setTurn(0);
    onPhase(planes.current ? "ready" : "finding");
  }, [resetKey]);

  const onTracking = (state: ViroTrackingState) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) onPhase(planes.current ? "ready" : "finding");
  };

  const onPinch = (state: ViroPinchStateTypes, factor: number) => {
    const next = Math.min(3, Math.max(0.05, base.current.scale * factor));
    setScale(next);
    if (state === ViroPinchStateTypes.PINCH_END) base.current.scale = next;
  };

  const onRotate = (state: ViroRotateStateTypes, factor: number) => {
    const next = base.current.turn - factor;
    setTurn(next);
    if (state === ViroRotateStateTypes.ROTATE_END) base.current.turn = next;
  };

  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesHorizontal"]}
      onTrackingUpdated={onTracking}
      onAmbientLightUpdate={setLight}
      onAnchorFound={(a) => {
        selector.current?.handleAnchorFound(a);
        if (a.type === "plane" && planes.current++ === 0) onPhase("ready");
      }}
      onAnchorUpdated={(a) => selector.current?.handleAnchorUpdated(a)}
      onAnchorRemoved={(a) => a && selector.current?.handleAnchorRemoved(a)}
    >
      <ViroAmbientLight color={light.color} intensity={light.intensity * 0.6} />
      <ViroSpotLight
        position={[0, 3, 1]}
        direction={[0, -1, -0.3]}
        innerAngle={5}
        outerAngle={60}
        attenuationStartDistance={4}
        attenuationEndDistance={8}
        color={light.color}
        intensity={light.intensity}
        castsShadow
        shadowMapSize={2048}
        shadowNearZ={1}
        shadowFarZ={6}
        shadowOpacity={0.55}
        influenceBitMask={2}
      />
      <ViroARPlaneSelector ref={selector} alignment="Horizontal" onPlaneSelected={() => onPhase("placed")}>
        <ViroNode dragType="FixedToWorld" onDrag={() => {}}>
          <Viro3DObject
            source={{ uri: modelUrl }}
            type="GLB"
            scale={[scale, scale, scale]}
            rotation={[0, turn, 0]}
            onPinch={onPinch}
            onRotate={onRotate}
            onLoadEnd={onModelLoaded}
            onError={onModelError}
            shadowCastingBitMask={2}
            lightReceivingBitMask={3}
          />
          <ViroQuad rotation={[-90, 0, 0]} width={3} height={3} arShadowReceiver lightReceivingBitMask={2} />
        </ViroNode>
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

const HINTS: Record<Phase, [string, string]> = {
  starting: ["Warming up AR…", "Hold your phone up"],
  finding: ["Find the floor", "Move your phone slowly over a table or the floor"],
  ready: ["Tap a surface", "Tap where it should stand"],
  placed: ["Strike a pose with it!", "Drag to move · pinch to resize · twist to turn"],
};

export function ARPhotoBoothScreen({ box }: { box: BoxView }) {
  const insets = useSafeAreaInsets();
  const nav = useRef<ViroARSceneNavigator>(null);
  const modelUrl = box.editedModelUrl ?? box.modelUrl;
  const [phase, setPhase] = useState<Phase>("starting");
  const [modelLoaded, setModelLoaded] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [shooting, setShooting] = useState(false);
  const [shot, setShot] = useState<string | null>(null);

  if (!modelUrl) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.msg}>This box has no 3D yet.</Text>
      </View>
    );
  }

  const shoot = async () => {
    if (!nav.current || shooting) return;
    setShooting(true);
    try {
      const res = (await nav.current._takeScreenshot(`tongpin-ar-${Date.now()}`, false)) as { success: boolean; url?: string; errorCode?: number };
      if (!res.success || !res.url) throw new Error(`screenshot failed (${res.errorCode ?? "?"})`);
      const uri = res.url.startsWith("file://") ? res.url : `file://${res.url}`;
      const context = ImageManipulator.manipulate(uri);
      context.resize({ height: SHOT_EDGE });
      const saved = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.88, base64: true });
      setShot(`data:image/jpeg;base64,${saved.base64}`);
    } catch (e) {
      console.warn("[ar-booth]", e);
      Alert.alert("Couldn't take the photo", "Try again in a moment.");
    } finally {
      setShooting(false);
    }
  };

  const [hintTitle, hint] = HINTS[phase];

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false }} />
      <ViroARSceneNavigator
        ref={nav}
        autofocus
        shadowsEnabled
        initialScene={{ scene: BoothScene as never }}
        viroAppProps={{
          modelUrl,
          resetKey,
          onPhase: setPhase,
          onModelLoaded: () => setModelLoaded(true),
          onModelError: () => Alert.alert("Couldn't load the 3D", "Check your connection and try again."),
        } satisfies AppProps}
        style={styles.fill}
      />

      <View style={[styles.topRow, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pill label="Close" onPress={() => router.back()} />
      </View>
      <View style={[styles.hintWrap, { top: insets.top + 66 }]} pointerEvents="none">
        <Text style={styles.hintTitle}>{hintTitle}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {phase === "placed" && !modelLoaded ? <ActivityIndicator color={C.white} style={{ marginTop: 8 }} /> : null}
      </View>

      <View style={[styles.shutterRow, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <Pill label="Reset" onPress={() => setResetKey((k) => k + 1)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          disabled={shooting}
          onPress={shoot}
          style={({ pressed }) => [(shooting || pressed) && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}
        >
          <Svg width={84} height={84}>
            <Path d={roughCircle(42, 42, 38, { seed: 5 })} fill={C.white} stroke={C.ink} strokeWidth={stroke.icon} />
            <Path d={roughCircle(42, 42, 28, { seed: 9 })} fill={C.orange} stroke={C.ink} strokeWidth={stroke.width} />
          </Svg>
        </Pressable>
        <View style={styles.pillSpacer} />
      </View>

      {shot ? <PhotoPreview box={box} jpeg={shot} onRetake={() => setShot(null)} onDone={() => router.back()} /> : null}
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const [w, setW] = useState(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
  topRow: { position: "absolute", left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" },
  hintWrap: { position: "absolute", left: 20, right: 20, alignItems: "center" },
  hintTitle: { color: C.white, fontSize: 30, lineHeight: 32, fontFamily: F.hand, textAlign: "center", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 5 },
  hint: { color: C.white, fontSize: 14, fontFamily: F.bold, textAlign: "center", textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 4 },
  shutterRow: { position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { minWidth: 76, height: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  pillSpacer: { width: 76 },
  pillText: { color: C.ink, fontSize: 15, fontFamily: F.heavy },
});
