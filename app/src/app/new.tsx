import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { api } from "../lib/backend";
import { pickImage, toUploadableJpeg, type LocalImage } from "../lib/images";
import { useProfile } from "../lib/session";
import { useUpload } from "../lib/upload";
import { useTask } from "../lib/useTask";
import { Button, Input, Muted, Screen, Section } from "../components/ui";

export default function NewBoxScreen() {
  const { userId } = useProfile();
  const create = useMutation(api.boxes.create);
  const { uploadUri } = useUpload();
  const { busy, run } = useTask();
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [note, setNote] = useState("");

  const pick = (source: "camera" | "library") =>
    run(async () => {
      const picked = await pickImage(source);
      if (picked) setPhoto(picked);
    });

  const send = () =>
    run(async () => {
      if (!photo) return;
      const jpeg = await toUploadableJpeg(photo);
      const photoStorageId = await uploadUri(jpeg.uri, "image/jpeg");
      const { boxId } = await create({ userId, photoStorageId, senderNote: note.trim() || undefined });
      router.replace(`/box/${boxId}`);
    });

  return (
    <Screen>
      <Section title="1. 拍一样东西">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="拍照" kind="secondary" onPress={() => pick("camera")} disabled={busy} />
          </View>
          <View style={styles.flex}>
            <Button title="从相册选" kind="secondary" onPress={() => pick("library")} disabled={busy} />
          </View>
        </View>
        {photo ? (
          <Image source={{ uri: photo.uri }} resizeMode="contain" style={[styles.preview, { aspectRatio: photo.width / photo.height }]} />
        ) : (
          <Muted>会转成 JPEG、长边缩到 1536 再上传</Muted>
        )}
      </Section>
      <Section title="2. 留一句话（可选）">
        <Input value={note} onChangeText={setNote} placeholder="比如：送你一样东西" maxLength={200} />
      </Section>
      <Button title="寄出" busy={busy} disabled={!photo} onPress={send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  preview: { width: "100%", maxHeight: 320, borderRadius: 12, backgroundColor: "#eee" },
});
