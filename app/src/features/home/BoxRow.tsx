import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { CapsuleIcon } from "../../components/ui";
import { colors, fonts, radii, stroke, useLoop } from "../../theme";

export type Trailing = { kind: "dot" } | { kind: "label"; text: string } | { kind: "none" };

// Inbox 一行：胶囊图标 + 两行文字 + 右侧闪烁圆点或动作文字。
export function BoxRow({ color, title, subtitle, trailing, onPress, icon }: { color: string; title: string; subtitle: string; trailing: Trailing; onPress: () => void; icon?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {icon ?? <CapsuleIcon color={color} />}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {trailing.kind === "dot" ? <BlinkDot /> : trailing.kind === "label" ? <Text style={styles.label}>{trailing.text}</Text> : null}
    </Pressable>
  );
}

function BlinkDot() {
  const blink = useLoop(2400);
  return <Animated.View style={[styles.dot, { opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 70,
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: radii.row,
  },
  pressed: { transform: [{ scale: 0.985 }] },
  text: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.heavy, fontSize: 16, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  label: { fontFamily: fonts.heavy, fontSize: 14, color: colors.ink },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.ink },
});
