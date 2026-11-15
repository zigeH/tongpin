import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, radii, sizes, stroke } from "../../theme";

// primary：58 高 ink 底 paper 字、圆角 29；secondary：白底 ink 描边；ghost：只有文字（"Save it for later"）。
export function Button({
  title,
  onPress,
  disabled,
  busy,
  kind = "primary",
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  kind?: "primary" | "secondary" | "ghost";
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[kind],
        pressed && (kind === "ghost" ? styles.ghostPressed : styles.pressed),
        inactive && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === "primary" ? colors.paper : colors.ink} />
      ) : (
        <Text style={[styles.text, kind === "primary" ? styles.textPrimary : kind === "ghost" ? styles.textGhost : null]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  primary: { height: sizes.button, borderRadius: radii.button, backgroundColor: colors.ink },
  secondary: {
    height: sizes.button,
    borderRadius: radii.button,
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
  },
  ghost: { height: sizes.hitTarget, alignSelf: "center", paddingHorizontal: 12 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  ghostPressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  text: { fontFamily: fonts.heavy, fontSize: 17, color: colors.ink },
  textPrimary: { color: colors.paper },
  textGhost: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted },
});
