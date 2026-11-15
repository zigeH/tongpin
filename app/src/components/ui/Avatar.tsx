import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../theme";

// 圆形头像：用户颜色 + 首字母，2px ink 描边。
export function Avatar({ name, color = colors.sun, size = 24 }: { name: string; color?: string; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.46) }]}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
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
