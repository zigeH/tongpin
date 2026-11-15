import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, sizes, stroke } from "../../theme";

// 有原生导航栏的普通页面：paper 底、可滚动。
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.ink} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.paper },
  screen: { padding: sizes.gutter, gap: 18, paddingBottom: 48 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.hand, fontSize: 26, color: colors.ink },
  input: {
    height: 54,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  loading: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.paper },
  label: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
});
