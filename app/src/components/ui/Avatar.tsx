import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme";

// 圆形头像：用户颜色 + 首字母，2px ink 描边。
export function Avatar({ name, color, size = 24 }: { name: string; color?: string; size?: number }) {
  const background = color || colors.sun;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.46), color: letterColor(background) }]}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

// Ink or paper, whichever contrasts more with the background (WCAG relative luminance).
function letterColor(background: string) {
  const bg = luminance(background);
  if (bg === null) return colors.ink;
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return contrast(bg, luminance(colors.ink)!) >= contrast(bg, luminance(colors.paper)!) ? colors.ink : colors.paper;
}

function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// "From Ari" 这种头像 + 名字的胶囊。
export function NamePill({ name, color, label }: { name: string; color?: string; label?: string }) {
  return (
    <View style={styles.pill}>
      <Avatar name={name} color={color} />
      <Text style={styles.pillText} numberOfLines={1}>
        {label ?? name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  letter: { fontFamily: fonts.heavy, color: colors.ink, includeFontPadding: false },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 12,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 999,
    maxWidth: 220,
  },
  pillText: { fontFamily: fonts.heavy, fontSize: 14, color: colors.ink, flexShrink: 1 },
});
