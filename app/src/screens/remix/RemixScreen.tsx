import { useMutation } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { api, type BoxView } from "../../lib/backend";
import { pickImage, toUploadableJpeg, type LocalImage } from "../../lib/images";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { showError } from "../../lib/errors";
import { colors, fonts, radii, stroke, useLoop, useScale } from "../../theme";
import { BodyText, Bubble, Button, ErrorText, HandText, RoughCard, bobo } from "../../components/ui";
import { ModelViewer, type ModelViewerHandle, type Snapshot } from "../../components/viewer3d";
import {
  Chip,
  Enter,
  Polaroid,
  STAGE_BG,
  StageBackdrop,
  Title,
  TopBar,
  TrottingBobo,
  TwinkleSparkle,
  ViewfinderCorners,
  useCycle,
  useFlash,
} from "./parts";

// The receiver's remix flow: spin the 3D → freeze an angle → one sentence (+ optional photo)
// → Bobo remixes (status editing) → result in picture + 3D → try again or write a note → seal.
// Serves both a claimed gift box and a remixBack relay box (sender = the other person).

const SUGGESTIONS = ["make it gold", "add a tiny hat", "turn it into a cake", "space version", "make it fluffy"];
const EDITING_LINES = ["Mixing paint…", "Adding magic…", "Polishing…", "Almost there…"];

type Step = "angle" | "prompt";

export function RemixScreen({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const submitEdit = useMutation(api.boxes.submitEdit);
  const seal = useMutation(api.boxes.seal);
  const { uploadUri, uploadBase64 } = useUpload();
  const { busy, run } = useTask();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("angle");
  const [redo, setRedo] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [extraPhoto, setExtraPhoto] = useState<LocalImage | null>(null);
  const [prompt, setPrompt] = useState(box.prompt ?? "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (box.status === "editing") setRedo(false);
  }, [box.status]);

  const other = { name: box.senderNickname || "your friend", color: box.senderColor };
  const close = () => router.dismissTo("/");

  const phase = sending
    ? "sending"
    : box.status === "editing"
      ? "editing"
      : box.status === "edited" && !redo
        ? "result"
        : step === "prompt" && snapshot
          ? "prompt"
          : "angle";

  const submit = () =>
    run(async () => {
      if (!snapshot) return;
      const snapshotStorageId = await uploadBase64(snapshot.pngBase64, "image/png");
      const extraPhotoStorageId = extraPhoto
        ? await uploadUri((await toUploadableJpeg(extraPhoto)).uri, "image/jpeg")
        : undefined;
      await submitEdit({
        boxId: box._id,
        userId,
        snapshotStorageId,
        cameraPose: snapshot.pose,
        prompt: prompt.trim(),
        extraPhotoStorageId,
      });
    });

  // Play Bobo's departure first: once seal lands, the box route swaps this screen out.
  const sendOff = async () => {
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 2300));
    try {
      await seal({ boxId: box._id, userId, receiverNote: note.trim() });
      router.dismissTo("/");
    } catch (error) {
      setSending(false);
      showError(error);
    }
  };

  const tryAgain = () => {
    setRedo(true);
    setStep(snapshot ? "prompt" : "angle");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {phase === "angle" ? (
          <AngleStep
            key="angle"
            box={box}
            other={other}
            onClose={redo ? () => setRedo(false) : close}
            closeLabel={redo ? "Back" : "Close"}
            onFrozen={(shot) => {
              setSnapshot(shot);
              setStep("prompt");
            }}
            bottomInset={insets.bottom}
          />
        ) : null}
        {phase === "prompt" && snapshot ? (
          <PromptStep
            key="prompt"
            box={box}
            other={other}
            snapshot={snapshot}
            extraPhoto={extraPhoto}
            onExtraPhoto={setExtraPhoto}
            prompt={prompt}
            onPrompt={setPrompt}
            onBack={() => setStep("angle")}
            onSubmit={submit}
            busy={busy}
            bottomInset={insets.bottom}
          />
        ) : null}
        {phase === "editing" ? (
          <EditingStep
            key="editing"
            other={other}
            snapshotUri={snapshot ? `data:image/png;base64,${snapshot.pngBase64}` : box.snapshotUrl}
            extraPhotoUri={extraPhoto?.uri ?? box.extraPhotoUrl}
            prompt={box.prompt ?? prompt}
            onClose={close}
          />
        ) : null}
        {phase === "result" ? (
          <ResultStep
            key="result"
            box={box}
            other={other}
            note={note}
            onNote={setNote}
            onClose={close}
            onTryAgain={tryAgain}
            onSeal={sendOff}
            bottomInset={insets.bottom}
          />
        ) : null}
        {phase === "sending" ? <SendOff key="sending" other={other} /> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

type Other = { name: string; color?: string };

function BottomBar({ children, bottomInset }: { children: ReactNode; bottomInset: number }) {
  return <View style={[styles.bottom, { paddingBottom: Math.max(bottomInset, 12) + 8 }]}>{children}</View>;
}

function AngleStep({
  box,
  other,
  onClose,
  closeLabel,
  onFrozen,
  bottomInset,
}: {
  box: BoxView;
  other: Other;
  onClose: () => void;
  closeLabel: string;
  onFrozen: (shot: Snapshot) => void;
  bottomInset: number;
}) {
  const { s, width } = useScale();
  const viewer = useRef<ModelViewerHandle>(null);
  const [loaded, setLoaded] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const flash = useFlash();
  const stageWidth = width - 36;
  const stageHeight = Math.round(Math.min(s(360), stageWidth * 1.05));
  const relay = box.replyTo !== undefined;

  const freeze = async () => {
    if (!viewer.current || freezing) return;
    setFreezing(true);
    try {
      const [shot] = await Promise.all([viewer.current.capture(), flash.fire()]);
      onFrozen(shot);
    } catch (error) {
      showError(error);
    } finally {
      setFreezing(false);
    }
  };

  return (
    <Enter>
      <View style={styles.pad}>
        <TopBar left={{ label: closeLabel, onPress: onClose }} name={other.name} color={other.color} label={`From ${other.name}`} step={0} />
        <Title sub={relay ? `${other.name} remixed it and sent it back. Your turn!` : `Spin ${other.name}'s gift. Freeze the view you want to remix.`}>
          Find a good angle
        </Title>
        <View style={[styles.stageCard, { height: stageHeight, marginTop: s(16) }]}>
          <StageBackdrop width={stageWidth} height={stageHeight} />
          {box.modelUrl ? (
            <ModelViewer
              ref={viewer}
              modelUrl={box.modelUrl}
              initialPose={box.cameraPose}
              onLoaded={() => setLoaded(true)}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.centerFill}>
              <BodyText weight="bold" color={colors.muted}>The 3D model isn't ready yet.</BodyText>
            </View>
          )}
          <ViewfinderCorners />
          <Chip label="↻ Drag to spin" style={styles.stageChip} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash.opacity }]} />
        </View>
        <View style={styles.shutterWrap}>
          <Shutter onPress={freeze} disabled={!loaded || freezing} />
          <BodyText size={14} weight="heavy">{freezing ? "Freezing…" : "Freeze this angle"}</BodyText>
        </View>
      </View>
      <View style={styles.flex} />
      <BottomBar bottomInset={bottomInset}>
        <View style={styles.boboHint}>
          <TrottingBobo source={bobo.run} size={86} />
          <Bubble size={20} tail="bottomLeft">Pick your fave side!</Bubble>
        </View>
      </BottomBar>
    </Enter>
  );
}

function Shutter({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Freeze this angle"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed, disabled && styles.disabled]}
    >
      <CameraGlyph />
    </Pressable>
  );
}

function CameraGlyph() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none" stroke={colors.ink} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M5.2 10.4c7-.6 14.6-.5 21.6.1.8 4.6.9 9.6 0 14.4-7.2.5-14.4.6-21.6 0-.7-4.8-.8-9.6 0-14.5z" fill={colors.white} />
      <Path d="M11 10.2l2.1-3.6h5.9l2 3.6" />
      <Circle cx={16} cy={17.6} r={4.6} fill={colors.cream} />
    </Svg>
  );
}

function PromptStep({
  box,
  other,
  snapshot,
  extraPhoto,
  onExtraPhoto,
  prompt,
  onPrompt,
  onBack,
  onSubmit,
  busy,
  bottomInset,
}: {
  box: BoxView;
  other: Other;
  snapshot: Snapshot;
  extraPhoto: LocalImage | null;
  onExtraPhoto: (photo: LocalImage | null) => void;
  prompt: string;
  onPrompt: (text: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  bottomInset: number;
}) {
  const { s } = useScale();
  const { run } = useTask();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const trimmed = prompt.trim();

  const addPhoto = () =>
    Alert.alert("Add a photo", "Mix something else into the remix.", [
      { text: "Take a photo", onPress: () => run(async () => onExtraPhoto((await pickImage("camera")) ?? extraPhoto)) },
      { text: "Choose from library", onPress: () => run(async () => onExtraPhoto((await pickImage("library")) ?? extraPhoto)) },
      ...(extraPhoto ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => onExtraPhoto(null) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);

  return (
    <Enter>
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <TopBar left={{ label: "Back", onPress: onBack }} name={other.name} color={other.color} label={`From ${other.name}`} step={1} />
        <Title sub="One sentence. Bobo does the rest.">What should it become?</Title>
        <View style={[styles.photoRow, { marginTop: s(18) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change the angle" onPress={onBack}>
            <Polaroid uri={`data:image/png;base64,${snapshot.pngBase64}`} caption="your angle" size={s(140)} rotate={-4} />
          </Pressable>
          <View style={styles.extraCol}>
            <Pressable accessibilityRole="button" accessibilityLabel={extraPhoto ? "Change the extra photo" : "Add a photo, optional"} onPress={addPhoto}>
              {extraPhoto ? (
                <Polaroid uri={extraPhoto.uri} caption="+ this" size={s(92)} rotate={4} />
              ) : (
                <View style={[styles.addTile, { width: s(108), height: s(108) }]}>
                  <Text style={styles.addPlus}>+</Text>
                  <BodyText size={12} weight="heavy" color={colors.muted}>Add a photo</BodyText>
                  <BodyText size={11} weight="bold" color={colors.muted}>optional</BodyText>
                </View>
              )}
            </Pressable>
            <BodyText size={12} weight="bold" color={colors.muted} style={styles.extraHint}>
              Mix in something else, like your cat.
            </BodyText>
          </View>
        </View>
        <RoughCard style={[styles.promptCard, { marginTop: s(18) }]} seed={11}>
          <TextInput
            value={prompt}
            onChangeText={onPrompt}
            placeholder={`Turn ${other.name}'s gift into…`}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={200}
            style={styles.promptInput}
            onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)}
            accessibilityLabel="Remix prompt"
          />
          <BodyText size={12} weight="bold" color={colors.muted} style={styles.counter}>
            {prompt.length}/200
          </BodyText>
        </RoughCard>
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((text) => (
            <Chip key={text} label={text} onPress={() => onPrompt(text)} active={trimmed === text} style={trimmed === text ? styles.suggestionActive : styles.suggestion} />
          ))}
        </View>
        {box.status === "claimed" && box.editError ? (
          <View style={styles.errorBox}>
            <ErrorText>Bobo tripped last time: {box.editError}. Try again?</ErrorText>
          </View>
        ) : null}
      </ScrollView>
      <BottomBar bottomInset={bottomInset}>
        <View style={styles.actionRow}>
          <View style={styles.boboSlot}>
            <TrottingBobo source={bobo.run} size={96} />
          </View>
          <Button title={busy ? "Packing…" : "Remix it ✨"} busy={busy} disabled={trimmed.length === 0} onPress={onSubmit} style={styles.flexButton} />
        </View>
      </BottomBar>
    </Enter>
  );
}

function EditingStep({
  other,
  snapshotUri,
  extraPhotoUri,
  prompt,
  onClose,
}: {
  other: Other;
  snapshotUri?: string;
  extraPhotoUri?: string;
  prompt: string;
  onClose: () => void;
}) {
  const { s } = useScale();
  const line = useCycle(EDITING_LINES, 2200);
  const wobble = useLoop(1600);
  const hop = useLoop(700);
  const rotate = wobble.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "-1deg"] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const tilt = hop.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });
  const short = prompt.length > 34 ? prompt.slice(0, 32).trimEnd() + "…" : prompt;

  return (
    <Enter>
      <View style={styles.pad}>
        <TopBar left={{ label: "Close", onPress: onClose }} name={other.name} color={other.color} label={`For ${other.name}`} step={1} />
        <Title sub="Usually under a minute. You can leave, Bobo keeps going.">Bobo is remixing…</Title>
      </View>
      <View style={[styles.editingStage, { height: s(440) }]}>
        <Animated.View style={[styles.editingPhoto, { transform: [{ rotate }] }]}>
          <Polaroid uri={snapshotUri} caption={line} size={s(160)} rotate={0} />
        </Animated.View>
        {extraPhotoUri ? (
          <View style={styles.editingExtra}>
            <Polaroid uri={extraPhotoUri} size={s(56)} rotate={8} />
          </View>
        ) : null}
        <TwinkleSparkle size={30} color={colors.sun} duration={1400} style={{ left: s(56), top: s(10) }} />
        <TwinkleSparkle size={24} color={colors.orange} duration={1100} delay={300} style={{ right: s(58), top: s(70) }} />
        <TwinkleSparkle size={20} color={colors.croc} duration={1700} delay={600} style={{ right: s(86), top: s(210) }} />
        <Animated.View style={[styles.editingBobo, { width: s(200), height: s(200), transform: [{ translateY: hopY }, { rotate: tilt }] }]}>
          <Image source={bobo.hold} style={{ width: s(200), height: s(200) }} accessibilityLabel="Bobo working on the remix" />
        </Animated.View>
        <Bubble size={22} tail="bottomRight" style={[styles.editingBubble, { top: s(232) }]}>
          {short ? `${short}\non it!` : "On it!"}
        </Bubble>
      </View>
    </Enter>
  );
}

function ResultStep({
  box,
  other,
  note,
  onNote,
  onClose,
  onTryAgain,
  onSeal,
  bottomInset,
}: {
  box: BoxView;
  other: Other;
  note: string;
  onNote: (text: string) => void;
  onClose: () => void;
  onTryAgain: () => void;
  onSeal: () => void;
  bottomInset: number;
}) {
  const { s } = useScale();
  const [view, setView] = useState<"3d" | "picture">(box.editedModelUrl ? "3d" : "picture");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const ready = note.trim().length > 0;

  return (
    <Enter>
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <TopBar left={{ label: "Close", onPress: onClose }} name={other.name} color={other.color} label={`For ${other.name}`} step={2} />
        <Title sub={box.prompt ? `“${box.prompt}”` : undefined}>Ta-da!</Title>
        <View style={[styles.resultCard, { marginTop: s(16) }]}>
          <View style={styles.resultHead}>
            <View style={styles.segment}>
              {box.editedModelUrl ? <Chip label="3D" active={view === "3d"} onPress={() => setView("3d")} style={styles.segmentChip} /> : null}
              {box.editedImageUrl ? <Chip label="Picture" active={view === "picture"} onPress={() => setView("picture")} style={styles.segmentChip} /> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={onTryAgain} hitSlop={8} style={styles.tryAgain}>
              <BodyText size={13} weight="heavy" color={colors.muted}>↻ Not quite? Try again</BodyText>
            </Pressable>
          </View>
          <View style={[styles.resultStage, { height: s(280) }]}>
            {view === "3d" && box.editedModelUrl ? (
              <>
                <StageBackdrop width={s(350)} height={s(280)} />
                <ModelViewer modelUrl={box.editedModelUrl} autoRotate style={StyleSheet.absoluteFill} />
                <Chip label="Drag to spin" style={styles.stageChip} />
                {box.editedImageUrl ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Show the remixed picture" onPress={() => setView("picture")} style={styles.thumb}>
                    <Polaroid uri={box.editedImageUrl} caption="photo" size={48} rotate={5} />
                  </Pressable>
                ) : null}
              </>
            ) : box.editedImageUrl ? (
              <Image source={{ uri: box.editedImageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel="Remixed picture" />
            ) : null}
          </View>
          <View style={styles.noteBox}>
            <BodyText size={12} weight="heavy" color={colors.muted}>A note for {other.name}</BodyText>
            <TextInput
              value={note}
              onChangeText={onNote}
              placeholder="Say something nice…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={200}
              style={styles.noteInput}
              onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)}
              accessibilityLabel={`Note for ${other.name}`}
            />
          </View>
        </View>
      </ScrollView>
      <BottomBar bottomInset={bottomInset}>
        <View style={styles.actionRow}>
          <View style={styles.boboSlot}>
            <TrottingBobo source={bobo.hold} size={96} period={1000} lift={5} />
          </View>
          <Button title={ready ? "Seal & send back" : "Write a note to seal"} disabled={!ready} onPress={onSeal} style={styles.flexButton} />
        </View>
      </BottomBar>
    </Enter>
  );
}

// Bobo picks up the capsule, hops, and walks off to the right.
function SendOff({ other }: { other: Other }) {
  const { s, width } = useScale();
  const walk = useRef(new Animated.Value(0)).current;
  const step = useLoop(700);
  useEffect(() => {
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(walk, { toValue: 1, duration: 1700, easing: Easing.bezier(0.5, 0, 0.7, 0.4), useNativeDriver: true }),
    ]).start();
  }, [walk]);
  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [0, width] });
  const stepY = step.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const stepTilt = step.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] });
  const bobo220 = s(220);

  return (
    <Enter>
      <View style={styles.pad}>
        <View style={styles.topBar} />
        <Title sub="Sealed with your note. Bobo is on the way.">{`Off to ${other.name}!`}</Title>
      </View>
      <View style={[styles.sendStage, { height: s(380) }]}>
        <StageGround width={width - 44} />
        <Animated.View style={{ position: "absolute", left: (width - 44 - bobo220) / 2, top: s(120), transform: [{ translateX }] }}>
          <Animated.View style={{ transform: [{ translateY: stepY }, { rotate: stepTilt }] }}>
            <Image source={bobo.hold} style={{ width: bobo220, height: bobo220 }} accessibilityLabel="Bobo carrying the box away" />
          </Animated.View>
        </Animated.View>
        <TwinkleSparkle size={26} color={colors.sun} duration={1200} style={{ left: s(30), top: s(70) }} />
        <TwinkleSparkle size={20} color={colors.orange} duration={1000} delay={200} style={{ right: s(40), top: s(40) }} />
      </View>
    </Enter>
  );
}

function StageGround({ width }: { width: number }) {
  return (
    <Svg width={width} height={380} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`M4 330c${width * 0.3} -2 ${width * 0.6} 2 ${width - 8} 0`} stroke={colors.ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M60 330c20-8 40-8 60 0M150 330c14-6 28-6 42 0" stroke={colors.croc} strokeWidth={4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 18, paddingBottom: 12 },
  topBar: { height: 44 },
  bottom: { paddingHorizontal: 18, paddingTop: 8 },
  stageCard: {
    backgroundColor: STAGE_BG,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: radii.card,
    overflow: "hidden",
  },
  centerFill: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 24 },
  stageChip: { position: "absolute", left: 12, bottom: 12 },
  flash: { backgroundColor: colors.white },
  shutterWrap: { marginTop: 20, alignItems: "center", gap: 8 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.sun,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  shutterPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } },
  disabled: { opacity: 0.4 },
  boboHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  photoRow: { flexDirection: "row", gap: 16, alignItems: "flex-start", paddingHorizontal: 4 },
  extraCol: { flex: 1, gap: 10, paddingTop: 8 },
  addTile: {
    borderWidth: stroke.width,
    borderStyle: "dashed",
    borderColor: colors.ink,
    borderRadius: radii.row,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "3deg" }],
  },
  addPlus: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 32, color: colors.ink },
  extraHint: { lineHeight: 16 },
  promptCard: { padding: 16, paddingBottom: 10 },
  promptInput: { fontFamily: fonts.hand, fontSize: 26, lineHeight: 28, color: colors.ink, minHeight: 84, textAlignVertical: "top", padding: 0 },
  counter: { textAlign: "right" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 8 },
  suggestion: { backgroundColor: colors.cream, paddingVertical: 6, paddingHorizontal: 12 },
  suggestionActive: { backgroundColor: colors.ink, paddingVertical: 6, paddingHorizontal: 12 },
  errorBox: { marginTop: 12, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: colors.danger, backgroundColor: colors.white },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  boboSlot: { width: 96, height: 96, marginLeft: -8 },
  flexButton: { flex: 1 },
  editingStage: { marginTop: 8, marginHorizontal: 18 },
  editingPhoto: { position: "absolute", alignSelf: "center", top: 26 },
  editingExtra: { position: "absolute", right: 30, top: 150 },
  editingBobo: { position: "absolute", alignSelf: "center", bottom: 0, marginLeft: 70 },
  editingBubble: { position: "absolute", left: 0, maxWidth: 190 },
  resultCard: {
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: radii.card,
    overflow: "hidden",
  },
  resultHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  segment: { flexDirection: "row", gap: 6 },
  segmentChip: { paddingHorizontal: 14 },
  tryAgain: { minHeight: 32, justifyContent: "center" },
  thumb: { position: "absolute", right: 10, bottom: 8 },
  resultStage: { backgroundColor: STAGE_BG, borderTopWidth: stroke.width, borderBottomWidth: stroke.width, borderColor: colors.ink },
  noteBox: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 2 },
  noteInput: { fontFamily: fonts.hand, fontSize: 24, lineHeight: 26, color: colors.ink, minHeight: 56, textAlignVertical: "top", padding: 0 },
  sendStage: { marginHorizontal: 22, marginTop: 20, overflow: "hidden" },
});
