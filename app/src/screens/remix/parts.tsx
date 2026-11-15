import { useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { colors, fonts, stroke, useEnter, useLoop } from "../../theme";
import { BodyText, HandText, NamePill } from "../../components/ui";

export const STAGE_BG = "#F1ECE2";
const STAGE_LINE = "#CFC6B8";
const STAGE_SHADOW = "#E3DACB";

export function TopBar({
  left,
  name,
  color,
  label,
  step,
}: {
  left?: { label: string; onPress: () => void };
  name: string;
  color?: string;
  label: string;
  step: number;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>
        {left ? (
          <Pressable accessibilityRole="button" onPress={left.onPress} hitSlop={10} style={styles.topLink}>
            <Text style={styles.topLinkText}>{left.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <NamePill name={name} color={color || undefined} label={label} />
      <View style={[styles.topSide, styles.dots]} accessibilityLabel={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={styles.titleWrap}>
      <HandText size={38} accessibilityRole="header" style={styles.center}>
        {children}
      </HandText>
      {sub ? (
        <BodyText size={15} color={colors.muted} style={[styles.center, styles.sub]}>
          {sub}
        </BodyText>
      ) : null}
    </View>
  );
}

export function Chip({ label, onPress, active, style }: { label: string; onPress?: () => void; active?: boolean; style?: StyleProp<ViewStyle> }) {
  const body = (
    <View style={[styles.chip, active && styles.chipActive, style]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={4} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

export function Polaroid({
  uri,
  caption,
  size,
  rotate,
  style,
}: {
  uri?: string;
  caption?: string;
  size: number;
  rotate: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.polaroid, { width: size + 16, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={[styles.polaroidPhoto, { height: size }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
      </View>
      <Text style={[styles.polaroidCaption, size < 80 && styles.polaroidCaptionSmall]} numberOfLines={1}>
        {caption ?? " "}
      </Text>
    </View>
  );
}

// Four-point sparkle with an ink outline.
export function Sparkle({ size, color, style }: { size: number; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 1.6c.9 5.1 2.6 7.6 9.6 9.9-6.8 1.6-8.6 4.4-9.5 10.9-1.2-6.3-3-9-10.1-10.5 7-1.9 9-4.9 10-10.3z"
          fill={color}
          stroke={colors.ink}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// Twinkling sparkle: scales and turns on its own loop.
export function TwinkleSparkle({ size, color, duration, delay = 0, style }: { size: number; color: string; duration: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const t = useLoop(duration, { delay });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "18deg"] });
  return (
    <Animated.View style={[{ position: "absolute", transform: [{ scale }, { rotate }] }, style]} pointerEvents="none">
      <Sparkle size={size} color={color} />
    </Animated.View>
  );
}

// The beige "room" behind the 3D model (wobbly floor + soft shadow), as on the Share screen.
export function StageBackdrop({ width, height }: { width: number; height: number }) {
  const floor = height * 0.78;
  const w = width;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={w / 2} cy={floor + 16} rx={w * 0.26} ry={12} fill={STAGE_SHADOW} />
      <Path
        d={`M0 ${floor}c${w * 0.18} -1.5 ${w * 0.32} 1.8 ${w * 0.5} 0.4s${w * 0.36} -1.2 ${w * 0.5} 0.8`}
        stroke={STAGE_LINE}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function ViewfinderCorners({ inset = 14, bottomInset = 48 }: { inset?: number; bottomInset?: number }) {
  const corner = (d: string, style: ViewStyle) => (
    <Svg width={34} height={34} style={[styles.corner, style]} pointerEvents="none">
      <Path d={d} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  return (
    <>
      {corner("M2.5 13.5V3.2h10.6", { left: inset, top: inset })}
      {corner("M31.5 13.5V2.8H20.6", { right: inset, top: inset })}
      {corner("M2.5 20.5v10.6h10.8", { left: inset, bottom: bottomInset })}
      {corner("M31.5 20.8v10.4H21", { right: inset, bottom: bottomInset })}
    </>
  );
}

// Bobo trotting in place (design .trot: 0.4s alternate, -7px, ±3deg).
export function TrottingBobo({ source, size, period = 800, lift = 7 }: { source: ImageSourcePropType; size: number; period?: number; lift?: number }) {
  const t = useLoop(period);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY }, { rotate }] }}>
      <Image source={source} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

// Each phase slides up and fades in when it mounts.
export function Enter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useEnter(280);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[{ flex: 1, opacity: v, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

// White flash over the stage when the angle is frozen.
export function useFlash() {
  const v = useRef(new Animated.Value(0)).current;
  const fire = () =>
    new Promise<void>((resolve) => {
      v.setValue(1);
      Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => resolve());
    });
  return { opacity: v, fire };
}

export function useCycle<T>(items: T[], every: number) {
  const [tick, next] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(next, every);
    return () => clearInterval(id);
  }, [every]);
  return items[tick % items.length];
}

const styles = StyleSheet.create({
  topBar: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topSide: { width: 60 },
  topLink: { height: 44, justifyContent: "center" },
  topLinkText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  dots: { flexDirection: "row", justifyContent: "flex-end", gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.ink },
  dotOn: { backgroundColor: colors.ink },
  titleWrap: { marginTop: 14, alignItems: "center" },
  center: { textAlign: "center" },
  sub: { marginTop: 6, lineHeight: 20 },
  pressed: { transform: [{ scale: 0.95 }] },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.heavy, fontSize: 12, color: colors.ink },
  chipTextActive: { color: colors.paper },
  polaroid: {
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 8,
    paddingBottom: 4,
  },
  polaroidPhoto: { backgroundColor: STAGE_BG, borderRadius: 2, overflow: "hidden" },
  polaroidCaption: { fontFamily: fonts.hand, fontSize: 19, lineHeight: 24, color: colors.ink, textAlign: "center" },
  polaroidCaptionSmall: { fontFamily: fonts.heavy, fontSize: 9, lineHeight: 14 },
  corner: { position: "absolute" },
});
