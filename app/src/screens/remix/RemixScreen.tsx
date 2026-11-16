import { useMutation } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { api, type BoxView } from "../../lib/backend";
import { pickImage, toUploadableJpeg, type LocalImage } from "../../lib/images";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { showError } from "../../lib/errors";
import { colors, fonts, radii, stroke, useLoop, useScale } from "../../theme";
import { Avatar, BodyText, Bubble, Button, ErrorText, HandText, RoughCard, bobo } from "../../components/ui";
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
  useCycle,
  useFlash,
} from "./parts";

// The receiver's remix flow: the friend's moment card (spin the 3D, one sentence, optional photo)
// → Remix screenshots the current 3D view in-flow → Bobo remixes (status editing)
// → result in picture + 3D → try again or write a note → seal.
// Serves both a claimed gift box and a remixBack relay box (sender = the other person).

const SUGGESTIONS = ["make it gold", "add a tiny hat", "turn it into a cake", "space version", "make it fluffy"];
const EDITING_LINES = ["Mixing paint…", "Adding magic…", "Polishing…", "Almost there…"];

const SEND_OFF_HOP_MS = 900;
const SEND_OFF_WALK_MS = 1500;
const SEND_OFF_MS = SEND_OFF_HOP_MS + SEND_OFF_WALK_MS + 300;

export function RemixScreen({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const claim = useMutation(api.boxes.claim);
  const submitEdit = useMutation(api.boxes.submitEdit);
  const seal = useMutation(api.boxes.seal);
  const { uploadUri, uploadBase64 } = useUpload();
  const { busy, run } = useTask();
  const insets = useSafeAreaInsets();

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
        : "moment";

  const submit = (capture: () => Promise<Snapshot>) =>
    run(async () => {
      const shot = await capture();
      setSnapshot(shot);
      // A box shared straight to this user arrives as "ready"; remixing it is what takes it.
      if (box.status === "ready") await claim({ code: box.code, userId });
      const snapshotStorageId = await uploadBase64(shot.pngBase64, "image/png");
      const extraPhotoStorageId = extraPhoto
        ? await uploadUri((await toUploadableJpeg(extraPhoto)).uri, "image/jpeg")
        : undefined;
      await submitEdit({
        boxId: box._id,
        userId,
        snapshotStorageId,
        cameraPose: shot.pose,
        prompt: prompt.trim(),
        extraPhotoStorageId,
      });
    });

  // Play Bobo's departure first: once seal lands, the box route swaps this screen out.
  const sendOff = async () => {
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, SEND_OFF_MS));
    try {
      await seal({ boxId: box._id, userId, receiverNote: note.trim() });
      router.dismissTo("/");
    } catch (error) {
      setSending(false);
      showError(error);
    }
  };

  const tryAgain = () => setRedo(true);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {phase === "moment" ? (
          <MomentStep
            key="moment"
            box={box}
            other={other}
            extraPhoto={extraPhoto}
            onExtraPhoto={setExtraPhoto}
            prompt={prompt}
            onPrompt={setPrompt}
            onClose={redo ? () => setRedo(false) : close}
            closeLabel={redo ? "Back" : "Close"}
            onRemix={submit}
            busy={busy}
            bottomInset={insets.bottom}
          />
        ) : null}
        {phase === "editing" ? (
          <EditingStep
            key="editing"
            other={other}
            snapshotUri={snapshot ? `data:image/png;base64,${snapshot.pngBase64}` : box.snapshotUrl}
            editedImageUri={box.editedImageUrl}
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
  const keyboard = useKeyboardVisible();
  return <View style={[styles.bottom, { paddingBottom: keyboard ? 8 : Math.max(bottomInset, 12) + 8 }]}>{children}</View>;
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

function useScrollEndOnKeyboard(scroll: RefObject<ComponentRef<typeof ScrollView> | null>) {
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => scroll.current?.scrollToEnd({ animated: true }));
    return () => sub.remove();
  }, [scroll]);
}

function MomentStep({
  box,
  other,
  extraPhoto,
  onExtraPhoto,
  prompt,
  onPrompt,
  onClose,
  closeLabel,
  onRemix,
  busy,
  bottomInset,
}: {
  box: BoxView;
  other: Other;
  extraPhoto: LocalImage | null;
  onExtraPhoto: (photo: LocalImage | null) => void;
  prompt: string;
  onPrompt: (text: string) => void;
  onClose: () => void;
  closeLabel: string;
  onRemix: (capture: () => Promise<Snapshot>) => void;
  busy: boolean;
  bottomInset: number;
}) {
  const { s, height } = useScale();
  const { run } = useTask();
  const viewer = useRef<ModelViewerHandle>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollEndOnKeyboard(scroll);
  const keyboard = useKeyboardVisible();
  const flash = useFlash();
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const stageHeight = Math.round(Math.max(s(200), Math.min(s(300), height - s(560))));
  const trimmed = prompt.trim();
  const relay = box.replyTo !== undefined;

  // The in-flow screenshot: whatever angle the user spun to is what Bobo remixes.
  const remix = () => {
    Keyboard.dismiss();
    onRemix(async () => {
      if (!viewer.current) throw new Error("The 3D model isn't ready yet.");
      const [shot] = await Promise.all([viewer.current.capture(), flash.fire()]);
      return shot;
    });
  };

  const addPhoto = () =>
    Alert.alert("Add a photo", "Mix something else into the remix.", [
      { text: "Take a photo", onPress: () => run(async () => onExtraPhoto((await pickImage("camera")) ?? extraPhoto)) },
      { text: "Choose from library", onPress: () => run(async () => onExtraPhoto((await pickImage("library")) ?? extraPhoto)) },
      ...(extraPhoto ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => onExtraPhoto(null) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);

  return (
    <Enter>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.pad}
        scrollEnabled={keyboard}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.momentHeader}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={styles.momentClose}>
            <BodyText size={16} weight="bold">{closeLabel}</BodyText>
          </Pressable>
          <HandText size={30} numberOfLines={1} accessibilityRole="header" style={styles.momentTitle}>
            {`${other.name}'s moment`}
          </HandText>
        </View>
        <RoughCard strokeWidth={stroke.width} style={{ marginTop: s(8) }} seed={7}>
          <View style={[styles.momentHead, { paddingHorizontal: s(14), paddingVertical: s(10), gap: s(10) }]}>
            <Avatar name={other.name} color={other.color} size={s(34)} />
            <View style={styles.flex}>
              <BodyText size={15} weight="heavy">{other.name}</BodyText>
              <BodyText size={12} color={colors.muted}>{relay ? "remixed it and sent it back" : "sent you a 3D moment"}</BodyText>
            </View>
            <Chip label="3D" style={styles.pill3d} />
          </View>
          <View style={[styles.momentStage, { height: stageHeight }]} onLayout={(e) => setStage(e.nativeEvent.layout)}>
            {stage.width > 0 ? <StageBackdrop width={stage.width} height={stage.height} /> : null}
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
            <Chip label="Drag to spin" style={styles.stageChip} />
            <Polaroid uri={box.photoUrl} caption="photo" size={s(44)} rotate={5} style={styles.thumb} />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash.opacity }]} />
          </View>
          {box.senderNote ? (
            <HandText size={24} style={styles.momentCaption}>{box.senderNote}</HandText>
          ) : (
            <View style={styles.momentCaptionEmpty} />
          )}
        </RoughCard>

        <BodyText size={13} weight="heavy" color={colors.muted} style={{ marginTop: s(14) }}>
          Remix it into anything · spin to the angle you like first
        </BodyText>
        <RoughCard style={styles.promptCardSmall} seed={11}>
          <TextInput
            value={prompt}
            onChangeText={onPrompt}
            placeholder={`Turn ${other.name}'s gift into…`}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={200}
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            style={styles.promptInputSmall}
            accessibilityLabel="Remix prompt"
          />
          {extraPhoto ? <Polaroid uri={extraPhoto.uri} size={36} rotate={6} style={styles.extraThumb} /> : null}
        </RoughCard>
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((text) => (
            <Chip key={text} label={text} onPress={() => onPrompt(text)} active={trimmed === text} style={trimmed === text ? styles.suggestionActive : styles.suggestion} />
          ))}
          <Chip label={extraPhoto ? "✓ photo" : "+ photo"} onPress={addPhoto} style={styles.suggestion} />
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
          <Button
            title={busy ? "Packing…" : "Remix ✨"}
            busy={busy}
            disabled={trimmed.length === 0 || !loaded}
            onPress={remix}
            style={styles.flexButton}
          />
        </View>
      </BottomBar>
    </Enter>
  );
}

function EditingStep({
  other,
  snapshotUri,
  editedImageUri,
  extraPhotoUri,
  prompt,
  onClose,
}: {
  other: Other;
  snapshotUri?: string;
  editedImageUri?: string;
  extraPhotoUri?: string;
  prompt: string;
  onClose: () => void;
}) {
  const { s } = useScale();
  const cycling = useCycle(EDITING_LINES, 2200);
  const line = editedImageUri ? "Building 3D…" : cycling;
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
        <Title sub={editedImageUri ? "The picture is ready. Now Bobo is shaping it in 3D." : "Usually under a minute. You can leave, Bobo keeps going."}>
          Bobo is remixing…
        </Title>
      </View>
      <View style={[styles.editingStage, { height: s(440) }]}>
        <Animated.View style={[styles.editingPhoto, { transform: [{ rotate }] }]}>
          <Polaroid uri={editedImageUri ?? snapshotUri} caption={line} size={s(160)} rotate={0} />
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
  useScrollEndOnKeyboard(scroll);
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

// Bobo hops with the capsule, then trots off to the right.
function SendOff({ other }: { other: Other }) {
  const { s, width } = useScale();
  const walk = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(SEND_OFF_HOP_MS),
      Animated.timing(walk, { toValue: 1, duration: SEND_OFF_WALK_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [walk]);
  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [0, width] });

  return (
    <Enter>
      <View style={styles.pad}>
        <View style={styles.topBar} />
        <Title sub="Sealed with your note. Bobo is on the way.">{`Off to ${other.name}!`}</Title>
      </View>
      <View style={[styles.sendStage, { height: s(380) }]}>
        <StageGround width={width - 44} />
        <Animated.View accessible accessibilityLabel="Bobo carrying the box away" style={[styles.sendBobo, { top: s(110), transform: [{ translateX }] }]}>
          <TrottingBobo source={bobo.hold} size={s(220)} period={700} lift={6} />
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
  momentHeader: { height: 44, flexDirection: "row", alignItems: "center" },
  momentClose: { minWidth: 56, height: 44, justifyContent: "center" },
  momentTitle: { flex: 1, textAlign: "center", marginRight: 56 },
  momentHead: { flexDirection: "row", alignItems: "center" },
  pill3d: { backgroundColor: colors.sun },
  momentStage: {
    marginHorizontal: stroke.width + 1,
    backgroundColor: STAGE_BG,
    borderTopWidth: stroke.width,
    borderBottomWidth: stroke.width,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  momentCaption: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  momentCaptionEmpty: { height: 12 },
  promptCardSmall: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  promptInputSmall: { flex: 1, fontFamily: fonts.hand, fontSize: 24, lineHeight: 26, color: colors.ink, minHeight: 30, maxHeight: 84, textAlignVertical: "top", padding: 0 },
  extraThumb: { marginVertical: -4 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 },
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
  sendBobo: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
