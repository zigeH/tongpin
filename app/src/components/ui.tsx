import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

// 朴素的基础组件，前端同学接手时整体替换即可。

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
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

export function Button({
  title,
  onPress,
  disabled,
  busy,
  kind = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  kind?: "primary" | "secondary";
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={[styles.button, kind === "secondary" && styles.buttonSecondary, inactive && styles.buttonDisabled]}
    >
      {busy ? (
        <ActivityIndicator color={kind === "primary" ? "#fff" : "#333"} />
      ) : (
        <Text style={[styles.buttonText, kind === "secondary" && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor="#999" {...props} style={[styles.input, props.style]} />;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 48 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  button: {
    backgroundColor: "#222",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  buttonSecondary: { backgroundColor: "#e8e8e8" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: "#222" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#bbb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  muted: { color: "#777", fontSize: 14 },
  error: { color: "#c0392b", fontSize: 14 },
  loading: { padding: 24, alignItems: "center", gap: 8 },
});
