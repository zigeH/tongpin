import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function Items() {
  const items = useQuery(api.items.list);
  const addItem = useMutation(api.items.add);
  const [text, setText] = useState("");

  const submit = async () => {
    if (!text.trim()) return;
    await addItem({ text });
    setText("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Items</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="New item"
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="done"
        />
        <Button title="Add" onPress={submit} />
      </View>
      {items === undefined ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <Text style={styles.item}>{item.text}</Text>}
          ListEmptyComponent={<Text style={styles.muted}>No items yet</Text>}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <Items />
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 16 },
  item: { fontSize: 18, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  muted: { color: "#888", fontSize: 16 },
});
