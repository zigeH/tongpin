import { useEffect, useRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Ellipse, Path } from "react-native-svg";
import { colors, fonts, STROKE, useScale } from "./theme";

const boboRun = require("../../../assets/send/bobo-run.png");

function useReducedMotion() {
  const reduced = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduced.current = v));
  }, []);
  return reduced;
}

// 设计稿 .trot：0.4s ease-in-out alternate，translateY 0→-7，rotate -3°→3°
export function TrottingBobo({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const t = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    if (!reduced.current) loop.start();
    return () => loop.stop();
  }, [t, reduced]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -7 * (size / 96)] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });
  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ translateY }, { rotate }] }, style]}>
      <Image source={boboRun} style={{ width: size, height: size }} accessibilityLabel="Bobo" />
    </Animated.View>
  );
}

export function Header({ title, left, onLeft }: { title: string; left?: string; onLeft?: () => void }) {
  const s = useScale();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { marginTop: Math.max(insets.top, 20), height: s(44) }]}>
      <Pressable onPress={onLeft} hitSlop={10} style={{ minWidth: s(52), height: s(44), justifyContent: "center" }}>
        {left ? <Text style={[styles.headerLeft, { fontSize: s(16) }]}>{left}</Text> : null}
      </Pressable>
      <Text style={[styles.headerTitle, { fontSize: s(28) }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: s(52) }} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  busy,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useScale();
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.primary,
        { height: s(58), borderRadius: s(29) },
        disabled && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.paper} /> : <Text style={[styles.primaryText, { fontSize: s(17) }]}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, style }: { title: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const s = useScale();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        { height: s(52), borderRadius: s(26) },
        disabled && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      <Text style={[styles.secondaryText, { fontSize: s(16) }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useScale();
  return <View style={[styles.card, { borderRadius: s(24) }, style]}>{children}</View>;
}

export function Pill({ label, background = colors.white, style }: { label: string; background?: string; style?: StyleProp<ViewStyle> }) {
  const s = useScale();
  return (
    <View style={[styles.pill, { backgroundColor: background, paddingHorizontal: s(10), paddingVertical: s(4) }, style]}>
      <Text style={[styles.pillText, { fontSize: s(12) }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, color, size = 34 }: { name: string; color: string; size?: number }) {
  const s = useScale();
  const d = s(size);
  return (
    <View style={[styles.avatar, { width: d, height: d, borderRadius: d / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: s(size * 0.42) }]}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

// 3D 预览后面的手绘小房间：地平线、窗户、影子。路径预先抖动过，近似设计稿的 feTurbulence 描边。
export function StageBackdrop({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 350 300" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={175} cy={248} rx={80} ry={12} fill={colors.stageShadow} />
      <Path
        d="M0 220.6 C40 219.4 80 221.2 120 219.8 S200 221 240 219.6 S310 220.8 350 220.1"
        stroke={colors.stageLine}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M250.4 40.6 L284.6 39.4 L320.2 40.8 L319.4 95 L320.6 150.2 L285 149.4 L249.6 150.6 L250.8 96 Z M285.2 40.2 L284.4 96 L285.4 149.8"
        stroke={colors.stageLine}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { fontFamily: fonts.bold, color: colors.ink },
  headerTitle: { fontFamily: fonts.hand, color: colors.ink, flexShrink: 1, textAlign: "center" },
  primary: { backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  primaryText: { fontFamily: fonts.heavy, color: colors.paper },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: STROKE,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontFamily: fonts.heavy, color: colors.ink },
  card: { backgroundColor: colors.white, borderWidth: STROKE, borderColor: colors.ink, overflow: "hidden" },
  pill: { borderWidth: 2, borderColor: colors.ink, borderRadius: 999, alignSelf: "flex-start" },
  pillText: { fontFamily: fonts.heavy, color: colors.ink },
  avatar: { borderWidth: STROKE, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.heavy, color: colors.ink },
});
