import { Image, StyleSheet, Text, View } from "react-native";
import type { BoxView } from "../../lib/backend";
import { STATUS_TEXT } from "../../lib/status";
import { Muted } from "../../components/ui";

export function BoxHeader({ box }: { box: BoxView }) {
  return (
    <View style={styles.header}>
      <Text style={styles.status}>{STATUS_TEXT[box.status]}</Text>
      <Muted>
        {box.senderNickname} 寄出{box.receiverNickname ? ` · ${box.receiverNickname} 收` : ""}
      </Muted>
      {box.senderNote ? <Text style={styles.note}>“{box.senderNote}”</Text> : null}
    </View>
  );
}

export function Picture({ uri, label }: { uri: string; label?: string }) {
  return (
    <View style={styles.picture}>
      {label ? <Muted>{label}</Muted> : null}
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  status: { fontSize: 18, fontWeight: "600" },
  note: { fontSize: 16, color: "#333" },
  picture: { gap: 4 },
  image: { width: "100%", height: 240, borderRadius: 12, backgroundColor: "#eef1f5" },
});
