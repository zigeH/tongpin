import { useMutation } from "convex/react";
import { File, Paths } from "expo-file-system";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type BoxView } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { Button, RoughCard } from "../../components/ui";
import { Header, Pill, stageColors, TrottingBobo } from "./parts";
import { colors, fonts, stroke, useScale } from "../../theme";

type Step = { label: string; done: boolean; active: boolean };

// A 寄出后等待：抠图 → 生成 3D（preparing），ready 后由 SendFlow 切到分享页。editError 时给重试。
export function WaitingScreen({ box }: { box: BoxView }) {
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  const failed = !!box.editError;
  const cutDone = !!box.cutoutUrl;
  const steps: Step[] = [
    { label: "Uploading photo", done: true, active: false },
    { label: "Cutting it out", done: cutDone, active: !cutDone },
    { label: "Building 3D", done: box.status !== "preparing", active: cutDone && box.status === "preparing" },
  ];

  return (
    <View style={[styles.screen, { paddingHorizontal: s(18), paddingBottom: Math.max(insets.bottom, s(20)) }]}>
      <Header title={failed ? "Oops!" : "Making magic"} left="Home" onLeft={() => router.dismissTo("/")} />
      <RoughCard strokeWidth={stroke.width} style={{ marginTop: s(10) }}>
        <View style={[styles.cardHead, { padding: s(12), gap: s(10) }]}>
          <Text style={[styles.cardTitle, { fontSize: s(15) }]}>Box {box.code}</Text>
          <Pill label={failed ? "failed" : box.status} background={failed ? "#FBD3BA" : box.status === "preparing" ? colors.sun : colors.croc} />
        </View>
        <View style={[styles.stage, { height: s(300) }]}>
          <Image
            source={{ uri: box.cutoutUrl ?? box.photoUrl }}
            resizeMode="contain"
            style={[styles.photo, !box.cutoutUrl && { opacity: 0.55 }]}
            accessibilityLabel="Your photo"
          />
          {failed ? null : <Spinner size={s(300) * 0.8} />}
        </View>
        <View style={{ padding: s(14), gap: s(8) }}>
          {failed ? (
            <Text style={[styles.error, { fontSize: s(15) }]}>{box.editError}</Text>
          ) : (
            steps.map((step) => <StepRow key={step.label} step={step} />)
          )}
        </View>
      </RoughCard>

      <View style={styles.spacer} />
      {failed ? (
        <Retry box={box} />
      ) : (
        <View style={[styles.footer, { gap: s(10) }]}>
          <TrottingBobo size={s(96)} style={{ marginLeft: -s(8) }} />
          <Text style={[styles.bubble, { fontSize: s(22) }]}>Bobo is packing your box… usually under a minute!</Text>
        </View>
      )}
    </View>
  );
}

function StepRow({ step }: { step: Step }) {
  const { s } = useScale();
  const d = s(22);
  return (
    <View style={[styles.stepRow, { gap: s(10) }]}>
      <View
        style={[
          styles.dot,
          { width: d, height: d, borderRadius: d / 2 },
          step.done && { backgroundColor: colors.croc },
          step.active && { backgroundColor: colors.sun },
        ]}
      >
        <Text style={[styles.dotText, { fontSize: s(12) }]}>{step.done ? "✓" : step.active ? "…" : ""}</Text>
      </View>
      <Text style={[styles.stepText, { fontSize: s(15) }, !step.done && !step.active && { color: colors.muted }]}>{step.label}</Text>
    </View>
  );
}

// 一圈虚线绕着照片慢慢转，表示正在处理
function Spinner({ size }: { size: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, transform: [{ rotate }] }]}
    />
  );
}

// 抠图失败：用同一张照片重新建一个盒子，或者换一张
function Retry({ box }: { box: BoxView }) {
  const { s } = useScale();
  const { userId } = useProfile();
  const create = useMutation(api.boxes.create);
  const { uploadUri } = useUpload();
  const { busy, run } = useTask();
  const retry = () =>
    run(async () => {
      const file = await File.downloadFileAsync(box.photoUrl, new File(Paths.cache, `retry-${Date.now()}.jpg`));
      try {
        const photoStorageId = await uploadUri(file.uri, "image/jpeg");
        const { boxId } = await create({ userId, photoStorageId, senderNote: box.senderNote });
        router.replace(`/box/${boxId}`);
      } finally {
        file.delete();
      }
    });
  return (
    <View style={{ gap: s(10) }}>
      <Button title="Try again" onPress={retry} busy={busy} />
      <Button kind="secondary" title="Pick another photo" onPress={() => router.replace("/new")} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: fonts.heavy, color: colors.ink },
  stage: {
    marginHorizontal: stroke.width + 1,
    backgroundColor: stageColors.bg,
    borderTopWidth: stroke.width,
    borderBottomWidth: stroke.width,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { width: "70%", height: "70%" },
  ring: { position: "absolute", borderWidth: 3, borderColor: colors.orange, borderStyle: "dashed" },
  stepRow: { flexDirection: "row", alignItems: "center" },
  dot: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  dotText: { fontFamily: fonts.heavy, color: colors.ink },
  stepText: { fontFamily: fonts.bold, color: colors.ink },
  error: { fontFamily: fonts.bold, color: colors.danger },
  spacer: { flex: 1 },
  footer: { flexDirection: "row", alignItems: "center" },
  bubble: { flex: 1, fontFamily: fonts.hand, color: colors.ink, lineHeight: 24 },
});
