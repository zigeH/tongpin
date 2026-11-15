import { Animated, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Ellipse, Path } from "react-native-svg";
import { bobo } from "../../components/ui";
import { colors, fonts, useLoop, useScale } from "../../theme";

// 设计稿 .trot：0.4s ease-in-out alternate，translateY 0→-7，rotate -3°→3°
export function TrottingBobo({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const t = useLoop(800);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -7 * (size / 96)] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] });
  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ translateY }, { rotate }] }, style]}>
      <Image source={bobo.run} style={{ width: size, height: size }} accessibilityLabel="Bobo" />
    </Animated.View>
  );
}

// 设计稿顶栏：左边文字按钮（Cancel），中间 Gaegu 28 标题，右边 52 宽占位
export function Header({ title, left, onLeft }: { title: string; left?: string; onLeft?: () => void }) {
  const { s } = useScale();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { marginTop: Math.max(insets.top, 20), height: s(44) }]}>
      <Pressable onPress={onLeft} hitSlop={10} accessibilityRole="button" style={{ minWidth: s(52), height: s(44), justifyContent: "center" }}>
        {left ? <Text style={[styles.headerLeft, { fontSize: s(16) }]}>{left}</Text> : null}
      </Pressable>
      <Text style={[styles.headerTitle, { fontSize: s(28) }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: s(52) }} />
    </View>
  );
}

export function Pill({ label, background = colors.white, style }: { label: string; background?: string; style?: StyleProp<ViewStyle> }) {
  const { s } = useScale();
  return (
    <View style={[styles.pill, { backgroundColor: background, paddingHorizontal: s(10), paddingVertical: s(4) }, style]}>
      <Text style={[styles.pillText, { fontSize: s(12) }]}>{label}</Text>
    </View>
  );
}

export const stageColors = { bg: "#F1ECE2", line: "#CFC6B8", shadow: "#E3DACB" };

// 3D 预览后面的手绘小房间：地平线、窗户、影子。路径预先抖动过，近似设计稿的 feTurbulence 描边。
export function StageBackdrop({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 350 300" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={175} cy={248} rx={80} ry={12} fill={stageColors.shadow} />
      <Path
        d="M0 220.6 C40 219.4 80 221.2 120 219.8 S200 221 240 219.6 S310 220.8 350 220.1"
        stroke={stageColors.line}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M250.4 40.6 L284.6 39.4 L320.2 40.8 L319.4 95 L320.6 150.2 L285 149.4 L249.6 150.6 L250.8 96 Z M285.2 40.2 L284.4 96 L285.4 149.8"
        stroke={stageColors.line}
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
  pill: { borderWidth: 2, borderColor: colors.ink, borderRadius: 999, alignSelf: "flex-start" },
  pillText: { fontFamily: fonts.heavy, color: colors.ink },
});
