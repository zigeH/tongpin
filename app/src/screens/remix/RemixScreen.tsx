import { useMutation } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, SvgXml } from "react-native-svg";
import { api, type BoxView } from "../../lib/backend";
import { openRealAR } from "../../lib/ar";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { showError } from "../../lib/errors";
import { colors, fonts, radii, stroke, useLoop, useScale } from "../../theme";
import { Avatar, BodyText, Bubble, Button, ErrorText, HandText, RoughCard, bobo } from "../../components/ui";
import { ModelViewer, type ModelViewerHandle, type Snapshot } from "../../components/viewer3d";
import {
  Chip,
  Enter,
  Polaroid,
  STAGE_BG,
  Sparkle,
  StageBackdrop,
  Title,
  TopBar,
  TrottingBobo,
  TwinkleSparkle,
  useCycle,
  useFlash,
} from "./parts";
import { PROPS, propNames, type PlacedProp, type PropKind } from "./props";

// The receiver's remix page (design 2-remix): the friend's 3D on top, stick props on it and/or write one line,
// then "Remix it and seal the box" captures the 3D view as it stands (angle + props) and submits it with
// seal: true, so the box seals itself once Bobo's remixed 3D lands.
// Boxes left in "edited" by the older flow still get the result + note + seal step.
// Serves both a claimed gift box and a remixBack relay box (sender = the other person).

const SUGGESTIONS = ["Make it cozy", "Space theme", "Make it tiny", "make it gold", "turn it into a cake"];
const EDITING_LINES = ["Mixing paint…", "Adding magic…", "Polishing…", "Almost there…"];

const SEND_OFF_HOP_MS = 900;
const SEND_OFF_WALK_MS = 1500;
const SEND_OFF_MS = SEND_OFF_HOP_MS + SEND_OFF_WALK_MS + 300;

export function RemixScreen({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const submitEdit = useMutation(api.boxes.submitEdit);
  const seal = useMutation(api.boxes.seal);
  const { uploadBase64 } = useUpload();
  const insets = useSafeAreaInsets();

  const [redo, setRedo] = useState(false);
  const [placed, setPlaced] = useState<PlacedProp[]>([]);
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
        : "compose";

  // Bobo trots off while the screenshot uploads; the remix and the seal finish on the server.
  const remixAndSeal = async (shot: Snapshot) => {
    setSending(true);
    try {
      await Promise.all([
        (async () => {
          const snapshotStorageId = await uploadBase64(shot.pngBase64, "image/png");
          await submitEdit({ boxId: box._id, userId, snapshotStorageId, cameraPose: shot.pose, prompt: prompt.trim(), props: propNames(placed), seal: true });
        })(),
        new Promise((resolve) => setTimeout(resolve, SEND_OFF_MS)),
      ]);
      router.dismissTo("/");
    } catch (error) {
      setSending(false);
      throw error;
    }
  };

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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {phase === "compose" ? (
          <ComposeStep
            key="compose"
            box={box}
            other={other}
            placed={placed}
            onPlaced={setPlaced}
            prompt={prompt}
            onPrompt={setPrompt}
            onClose={redo ? () => setRedo(false) : close}
            closeLabel={redo ? "Back" : "Close"}
            onRemix={remixAndSeal}
            bottomInset={insets.bottom}
          />
        ) : null}
        {phase === "editing" ? (
          <EditingStep
            key="editing"
            other={other}
            snapshotUri={box.snapshotUrl}
            editedImageUri={box.editedImageUrl}
            extraPhotoUri={box.extraPhotoUrl}
            prompt={box.prompt || (box.props ?? []).join(", ")}
            autoSeal={box.autoSeal === true}
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
            onTryAgain={() => setRedo(true)}
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

function ComposeStep({
  box,
  other,
  placed,
  onPlaced,
  prompt,
  onPrompt,
  onClose,
  closeLabel,
  onRemix,
  bottomInset,
}: {
  box: BoxView;
  other: Other;
  placed: PlacedProp[];
  onPlaced: (next: PlacedProp[]) => void;
  prompt: string;
  onPrompt: (text: string) => void;
  onClose: () => void;
  closeLabel: string;
  onRemix: (shot: Snapshot) => Promise<void>;
  bottomInset: number;
}) {
  const { s } = useScale();
  const viewer = useRef<ModelViewerHandle>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollEndOnKeyboard(scroll);
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const flash = useFlash();
  const trimmed = prompt.trim();
  const ready = loaded && (trimmed.length > 0 || placed.length > 0);

  const stick = (kind: PropKind) => {
    const twins = placed.filter((p) => p.kind.id === kind.id).length;
    const prop = { key: `${kind.id}-${Date.now()}`, kind, x: kind.at[0] + twins * 0.06, y: kind.at[1] + twins * 0.04, size: 0.26 };
    onPlaced([...placed, prop]);
    setSelected(prop.key);
  };
  const move = (key: string, x: number, y: number) =>
    onPlaced(placed.map((p) => (p.key === key ? { ...p, x: clamp(x), y: clamp(y) } : p)));
  const remove = (key: string) => onPlaced(placed.filter((p) => p.key !== key));

  // The screenshot is the 3D view as it stands right now (angle + stuck-on props); it drives the remix.
  const remix = async () => {
    if (!viewer.current || capturing) return;
    setCapturing(true);
    setSelected(null);
    try {
      const [shot] = await Promise.all([
        viewer.current.capture(placed.map((p) => ({ svg: p.kind.svg, x: p.x, y: p.y, size: p.size }))),
        flash.fire(),
      ]);
      await onRemix(shot);
    } catch (error) {
      showError(error);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Enter>
      <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <View style={styles.composeHead}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={styles.headSide}>
            <BodyText size={16} weight="bold">{closeLabel}</BodyText>
          </Pressable>
          <HandText size={28} accessibilityRole="header" numberOfLines={1} style={styles.headTitle}>
            {`Remix ${other.name}'s gift`}
          </HandText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo the last prop"
            accessibilityState={{ disabled: placed.length === 0 }}
            disabled={placed.length === 0}
            onPress={() => onPlaced(placed.slice(0, -1))}
            hitSlop={10}
            style={[styles.headSide, styles.headRight, placed.length === 0 && styles.disabled]}
          >
            <BodyText size={16} weight="bold">Undo</BodyText>
          </Pressable>
        </View>
        {box.senderNote ? (
          <View style={styles.noteRow}>
            <Avatar name={other.name} color={other.color} size={30} />
            <Bubble size={20} tail="bottomLeft" style={styles.noteBubble}>{`“${box.senderNote}”`}</Bubble>
          </View>
        ) : null}
        <View
          style={[styles.stageCard, { height: s(340), marginTop: s(12) }]}
          onLayout={(e) => setStage({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          {stage.width > 0 ? <StageBackdrop width={stage.width} height={stage.height} /> : null}
          {box.modelUrl ? (
            <ModelViewer ref={viewer} modelUrl={box.modelUrl} initialPose={box.cameraPose} onLoaded={() => setLoaded(true)} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={styles.centerFill}>
              <BodyText weight="bold" color={colors.muted}>The 3D model isn't ready yet.</BodyText>
            </View>
          )}
          {stage.width > 0
            ? placed.map((p) => (
                <StuckProp
                  key={p.key}
                  prop={p}
                  stage={stage}
                  selected={selected === p.key}
                  onSelect={() => setSelected(p.key)}
                  onMove={(x, y) => move(p.key, x, y)}
                  onRemove={() => remove(p.key)}
                />
              ))
            : null}
          <Chip label="3D · drag to spin" style={styles.stageChipTop} />
          {box.modelUrl ? <Chip label="AR" onPress={() => openRealAR(box.modelUrl, box.modelUsdzUrl)} style={styles.arChip} /> : null}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash.opacity }]} />
        </View>

        <View style={[styles.sectionHead, { marginTop: s(18) }]}>
          <HandText size={24}>Add a prop</HandText>
          <BodyText size={12} weight="bold" color={colors.muted}>tap to stick it on</BodyText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray} keyboardShouldPersistTaps="handled">
          {PROPS.map((kind) => {
            const on = placed.some((p) => p.kind.id === kind.id);
            return (
              <Pressable
                key={kind.id}
                accessibilityRole="button"
                accessibilityLabel={`Stick on a ${kind.label.toLowerCase()}`}
                onPress={() => stick(kind)}
                style={({ pressed }) => [styles.propTile, on && styles.propTileOn, pressed && styles.pressedTile]}
              >
                <SvgXml xml={kind.svg} width={40} height={40} />
              </Pressable>
            );
          })}
        </ScrollView>

        <HandText size={24} style={{ marginTop: s(18) }}>Or remix it in one line</HandText>
        <RoughCard style={styles.lineCard} seed={11}>
          <TextInput
            value={prompt}
            onChangeText={onPrompt}
            placeholder={`Turn ${other.name}'s gift into…`}
            placeholderTextColor={colors.muted}
            maxLength={200}
            returnKeyType="done"
            style={styles.lineInput}
            accessibilityLabel="Remix prompt"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Surprise me"
            onPress={() => onPrompt(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])}
            hitSlop={6}
            style={styles.magic}
          >
            <Sparkle size={22} color={colors.sun} />
          </Pressable>
        </RoughCard>
        <View style={styles.suggestions}>
          {SUGGESTIONS.slice(0, 3).map((text) => (
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
        <Button title={capturing ? "Snapping…" : "Remix it and seal the box"} busy={capturing} disabled={!ready} onPress={remix} />
      </BottomBar>
    </Enter>
  );
}

const clamp = (n: number) => Math.min(0.95, Math.max(0.05, n));

// A sticker on the stage: drag to move, tap to select, × to remove. Positions are fractions of the stage.
function StuckProp({
  prop,
  stage,
  selected,
  onSelect,
  onMove,
  onRemove,
}: {
  prop: PlacedProp;
  stage: { width: number; height: number };
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const side = prop.size * stage.width;
  const latest = useRef({ prop, stage, onSelect, onMove });
  latest.current = { prop, stage, onSelect, onMove };
  const start = useRef({ x: 0, y: 0 });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = { x: latest.current.prop.x, y: latest.current.prop.y };
        latest.current.onSelect();
      },
      onPanResponderMove: (_, g) => {
        const { stage: st } = latest.current;
        latest.current.onMove(start.current.x + g.dx / st.width, start.current.y + g.dy / st.height);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel={`${prop.kind.label} sticker`}
      style={[
        styles.stuck,
        { width: side, height: side, left: prop.x * stage.width - side / 2, top: prop.y * stage.height - side / 2 },
        selected && styles.stuckSelected,
      ]}
    >
      <SvgXml xml={prop.kind.svg} width="100%" height="100%" />
      {selected ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove the ${prop.kind.label.toLowerCase()}`} onPress={onRemove} hitSlop={8} style={styles.stuckRemove}>
          <Text style={styles.stuckRemoveText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EditingStep({
  other,
  snapshotUri,
  editedImageUri,
  extraPhotoUri,
  prompt,
  autoSeal,
  onClose,
}: {
  other: Other;
  snapshotUri?: string;
  editedImageUri?: string;
  extraPhotoUri?: string;
  prompt: string;
  autoSeal: boolean;
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
        <Title
          sub={
            autoSeal
              ? `You can leave. Bobo seals the box and sends it to ${other.name} when the 3D is done.`
              : editedImageUri
                ? "The picture is ready. Now Bobo is shaping it in 3D."
                : "Usually under a minute. You can leave, Bobo keeps going."
          }
        >
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
        {box.editedModelUrl ? (
          <Button kind="secondary" title="Take a photo with it" onPress={() => router.push(`/photo/${box._id}`)} style={styles.photoButton} />
        ) : null}
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
  composeHead: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  headSide: { width: 56, height: 44, justifyContent: "center" },
  headRight: { alignItems: "flex-end" },
  headTitle: { flex: 1, textAlign: "center" },
  noteRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 6 },
  noteBubble: { flexShrink: 1 },
  stageChipTop: { position: "absolute", left: 12, top: 12 },
  arChip: { position: "absolute", right: 12, top: 12 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  tray: { gap: 10, paddingVertical: 8, paddingRight: 8 },
  propTile: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  propTileOn: { backgroundColor: colors.sun },
  pressedTile: { transform: [{ scale: 0.94 }] },
  stuck: { position: "absolute" },
  stuckSelected: { borderWidth: 2, borderStyle: "dashed", borderColor: colors.ink, borderRadius: 6 },
  stuckRemove: {
    position: "absolute",
    right: -12,
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  stuckRemoveText: { fontFamily: fonts.heavy, fontSize: 15, lineHeight: 17, color: colors.ink },
  lineCard: { marginTop: 8, paddingVertical: 6, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  lineInput: { flex: 1, fontFamily: fonts.hand, fontSize: 24, lineHeight: 28, color: colors.ink, paddingVertical: 8 },
  magic: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  photoButton: { marginBottom: 8 },
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
  disabled: { opacity: 0.4 },
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
  sendBobo: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
