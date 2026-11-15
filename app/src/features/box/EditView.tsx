import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { api, type BoxView } from "../../lib/backend";
import { pickImage, toUploadableJpeg, type LocalImage } from "../../lib/images";
import { useProfile } from "../../lib/session";
import { useUpload } from "../../lib/upload";
import { useTask } from "../../lib/useTask";
import { ModelViewer, type ModelViewerHandle, type Snapshot } from "../../components/ModelViewer";
import { Button, ErrorText, Input, Loading, Muted, Screen, Section } from "../../components/ui";
import { BoxHeader, Picture } from "./common";

// B 的改造：转 3D → 定格 → 一句话 → 等 edited → 封箱。edited 后也可以重来。
export function EditView({ box }: { box: BoxView }) {
  const { userId } = useProfile();
  const submitEdit = useMutation(api.boxes.submitEdit);
  const seal = useMutation(api.boxes.seal);
  const { uploadUri, uploadBase64 } = useUpload();
  const { busy, run } = useTask();
  const viewer = useRef<ModelViewerHandle>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [extraPhoto, setExtraPhoto] = useState<LocalImage | null>(null);
  const [prompt, setPrompt] = useState(box.prompt ?? "");
  const [receiverNote, setReceiverNote] = useState("");

  const editing = box.status === "editing";

  const capture = () => run(async () => setSnapshot(await viewer.current!.capture()));

  const pickExtra = () =>
    run(async () => {
      const picked = await pickImage("library");
      if (picked) setExtraPhoto(picked);
    });

  const submit = () =>
    run(async () => {
      if (!snapshot) return;
      const snapshotStorageId = await uploadBase64(snapshot.pngBase64, "image/png");
      const extraPhotoStorageId = extraPhoto
        ? await uploadUri((await toUploadableJpeg(extraPhoto)).uri, "image/jpeg")
        : undefined;
      await submitEdit({
        boxId: box._id,
        userId,
        snapshotStorageId,
        cameraPose: snapshot.pose,
        prompt: prompt.trim(),
        extraPhotoStorageId,
      });
    });

  const doSeal = () => run(() => seal({ boxId: box._id, userId, receiverNote: receiverNote.trim() }));

  return (
    <Screen>
      <BoxHeader box={box} />

      {box.status === "edited" ? (
        <Section title="改造结果">
          {box.editedImageUrl ? <Picture uri={box.editedImageUrl} label="改后图片" /> : null}
          {box.editedModelUrl ? <ModelViewer modelUrl={box.editedModelUrl} /> : <Muted>改后 3D 还没好</Muted>}
          <Input value={receiverNote} onChangeText={setReceiverNote} placeholder="封箱时写给对方的一句话" maxLength={200} />
          <Button title="封箱寄回" busy={busy} disabled={receiverNote.trim().length === 0} onPress={doSeal} />
          <Muted>不满意？下面可以重新定格、再改一次。</Muted>
        </Section>
      ) : null}

      <Section title="1. 拖动旋转，找个角度定格">
        {box.modelUrl ? <ModelViewer ref={viewer} modelUrl={box.modelUrl} /> : <Muted>还没有 3D 模型</Muted>}
        <Button title="定格" kind="secondary" disabled={!box.modelUrl || busy || editing} onPress={capture} />
        {snapshot ? (
          <View style={styles.snapshotRow}>
            <Image source={{ uri: `data:image/png;base64,${snapshot.pngBase64}` }} style={styles.snapshot} />
            <Muted>已定格（透明 PNG）</Muted>
          </View>
        ) : null}
      </Section>

      <Section title="2. 一句话改造">
        <Input value={prompt} onChangeText={setPrompt} placeholder="比如：给它戴一顶草帽" maxLength={200} editable={!editing} />
        <Button title={extraPhoto ? "换一张参考照片" : "加一张参考照片（可选）"} kind="secondary" disabled={busy || editing} onPress={pickExtra} />
        {extraPhoto ? <Image source={{ uri: extraPhoto.uri }} style={styles.snapshot} /> : null}
        {box.status === "claimed" && box.editError ? <ErrorText>上次改造失败：{box.editError}</ErrorText> : null}
        {editing ? (
          <Loading label="改造中…" />
        ) : (
          <Button title="改造" busy={busy} disabled={!snapshot || prompt.trim().length === 0} onPress={submit} />
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  snapshotRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  snapshot: { width: 96, height: 96, borderRadius: 8, backgroundColor: "#dde3ea" },
});
