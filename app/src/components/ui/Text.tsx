import type { ReactNode } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, fonts } from "../../theme";

// 手写标题（Gaegu 700）。
export function HandText({ size = 40, style, ...props }: TextProps & { size?: number }) {
  return <Text {...props} style={[{ fontFamily: fonts.hand, fontSize: size, lineHeight: size * 1.05, color: colors.ink }, style]} />;
}

type Weight = "regular" | "bold" | "heavy";
const WEIGHT = { regular: fonts.body, bold: fonts.bold, heavy: fonts.heavy };

// 正文（Nunito）。
export function BodyText({ size = 16, weight = "regular", color = colors.ink, style, ...props }: TextProps & { size?: number; weight?: Weight; color?: string }) {
  return <Text {...props} style={[{ fontFamily: WEIGHT[weight], fontSize: size, color }, style]} />;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextProps["style"] }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
  error: { fontFamily: fonts.bold, color: colors.danger, fontSize: 14 },
});
