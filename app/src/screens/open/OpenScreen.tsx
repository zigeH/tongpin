import { useMutation } from "convex/react";
import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModelViewer } from "../../components/ModelViewer";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useTask } from "../../lib/useTask";
import { BigBang, TAP, elapsed } from "./BigBang";
import { colors as C, DESIGN_WIDTH as CANVAS_WIDTH, fonts as F, radii } from "../../theme";
import { Button, NamePill, RoughCard } from "../../components/ui";
import { T, ease, track } from "./timeline";
import { PhotoStrip } from "../photo/PhotoStrip";

// How long the edited picture stays over the 3D viewer after it mounts, until the viewer reports loading.

// A opens the box B remixed: tap the ball, big bang, B's remix floats up, the card rises.
export function OpenScreen({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const open = useMutation(api.boxes.open);
  const remixBack = useMutation(api.boxes.remixBack);
  const { busy, run } = useTask();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [openedBox, setOpenedBox] = useState<BoxView | null>(null);
  const [phase, setPhase] = useState<"sealed" | "opening" | "opened">(box.status === "opened" ? "opened" : "sealed");
  const [show3d, setShow3d] = useState(box.status === "opened");
  const [cardHeight, setCardHeight] = useState(320);

  const now = useSharedValue(0);
  const tapAt = useSharedValue(box.status === "opened" ? TAP.longAgo : TAP.sealed);
  const imageCover = useSharedValue(1);
  useFrameCallback((frame) => {
    now.value = frame.timestamp;
    if (tapAt.value === TAP.pending) tapAt.value = frame.timestamp;
  });

  const view = box.status === "opened" ? box : (openedBox ?? box);
  const remixer = view.receiverNickname ?? "Your friend";

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    tapAt.value = reduceMotion ? TAP.longAgo : TAP.pending;
    setPhase("opening");
    later(reduceMotion ? 0 : T.end, () => setPhase("opened"));
    later(reduceMotion ? 0 : T.prize.delay, () => setShow3d(true));
  };

  const tapBall = () => {
    if (phase !== "sealed") return;
    play();
    void run(async () => {
      try {
        setOpenedBox(await open({ boxId: box._id, userId }));
      } catch (error) {
        timers.current.forEach(clearTimeout);
        tapAt.value = TAP.sealed;
        setPhase("sealed");
        throw error;
      }
    });
  };

  useEffect(() => {
    if (!show3d || !view.editedModelUrl) return;
    imageCover.value = 1;
  }, [show3d, view.editedModelUrl, imageCover]);

  const sendBack = () =>
    run(async () => {
      const { boxId } = await remixBack({ boxId: box._id, userId });
      router.push(`/box/${boxId}`);
    });

  const shareUnboxing = () =>
    Alert.alert("Coming soon", "Saving the unboxing as a video is on its way.");

  const clock = { now, tapAt };
  const sealedText = useAnimatedStyle(() => ({
    opacity: elapsed(clock) < 0 ? 1 : track(elapsed(clock), 0, 200, [0, 1], [1, 0], ease.out),
  }));
  const openedText = useAnimatedStyle(() => ({
    opacity: track(elapsed(clock), T.opened.delay, T.opened.duration, [0, 1], [0, 1], ease.out, 0),
  }));
  const card = useAnimatedStyle(() => ({
    transform: [
      { translateY: track(elapsed(clock), T.card.delay, T.card.duration, [0, 1], [cardHeight * 1.15, 0], ease.rise, cardHeight * 1.15) },
    ],
  }));
  const cover = useAnimatedStyle(() => ({ opacity: imageCover.value }));

  const scale = width / CANVAS_WIDTH;
  const canvasHeight = height / scale;
  const headerTop = Math.max(54, insets.top / scale + 4);

  const prize = (
    <View style={styles.prizeInner}>
      {show3d && view.editedModelUrl ? (
        <ModelViewer
          modelUrl={view.editedModelUrl}
          autoRotate
          showLoading={!view.editedImageUrl}
          onLoaded={() => {
            imageCover.value = withTiming(0, { duration: 400 });
          }}
          style={styles.viewer}
        />
      ) : null}
      {view.editedImageUrl ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, cover]}>
          <Image source={{ uri: view.editedImageUrl }} style={styles.prizeImage} resizeMode="contain" />
        </Animated.View>
      ) : (
        <ActivityIndicator color={C.ink} />
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.canvas, { height: canvasHeight, transform: [{ scale }] }]}>
        <View style={[styles.header, { top: headerTop }]}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <NamePill name={remixer} color={view.receiverColor} label={`From ${remixer}`} />
          <View style={styles.headerSpacer} />
        </View>

        <Animated.View pointerEvents="none" style={[styles.titleBlock, { top: headerTop + 62 }, sealedText]}>
          <Text style={styles.title}>Your box is here!</Text>
          <Text style={styles.subtitle}>Tap the ball. Something big is inside.</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.titleBlock, { top: headerTop + 62 }, openedText]}>
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            {view.prompt ?? "Ta-da!"}
          </Text>
          <Text style={styles.subtitle}>{view.editedModelUrl ? "Drag to spin it in 3D" : " "}</Text>
        </Animated.View>

        <BigBang clock={clock} onTapBall={tapBall} prize={prize} prizeTouchable={phase === "opened"} />

        <Animated.View
          style={[styles.card, card]}
          pointerEvents={phase === "opened" ? "auto" : "none"}
          onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
        >
          <RoughCard radius={radii.cardLg} strokeWidth={2.5} style={styles.cardBody}>
            {view.receiverNote ? <Text style={styles.note}>“{view.receiverNote}”</Text> : null}
            {view.prompt ? (
              <Text style={styles.remixLine}>
                {remixer}'s remix: {view.prompt}
              </Text>
            ) : null}
            {phase === "opened" ? <PhotoStrip boxId={view._id} size={64} /> : null}
            <Button title="Remix it and send it back" busy={busy} onPress={sendBack} style={styles.primary} />
            <View style={styles.links}>
              <Button kind="ghost" title="Take a photo with it" onPress={() => router.push(`/photo/${view._id}`)} />
              <Button kind="ghost" title="Replay" onPress={play} />
              <Button kind="ghost" title="Share the unboxing" onPress={shareUnboxing} />
            </View>
          </RoughCard>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper, overflow: "hidden" },
  canvas: { width: CANVAS_WIDTH, transformOrigin: "top left", backgroundColor: C.paper },
  header: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 8,
  },
  close: { height: 44, justifyContent: "center", width: 60 },
  closeText: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  headerSpacer: { width: 60 },
  titleBlock: { position: "absolute", left: 24, right: 24, alignItems: "center", zIndex: 2 },
  title: { fontFamily: F.hand, fontSize: 42, lineHeight: 42, color: C.ink, textAlign: "center" },
  subtitle: { marginTop: 8, fontFamily: F.body, fontSize: 15, color: C.muted, textAlign: "center" },
  prizeInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewer: { ...StyleSheet.absoluteFill, height: undefined, borderRadius: 0, backgroundColor: "transparent" },
  prizeImage: { width: "100%", height: "100%" },
  card: { position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 7 },
  cardBody: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  note: { fontFamily: F.hand, fontSize: 30, lineHeight: 34.5, color: C.ink },
  remixLine: { fontFamily: F.body, fontSize: 13, color: C.muted },
  primary: { marginTop: 6 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4 },
});
