import { StyleSheet, Text } from "react-native";
import type { BoxView } from "../../lib/backend";
import { ErrorText, Loading, Muted, Screen, Section } from "../../components/ui";
import { BoxHeader, Picture } from "./common";

// A 寄出后：preparing 时等待抠图和 3D，ready 之后显示盒子码给 B。
export function SenderWaitingView({ box }: { box: BoxView }) {
  return (
    <Screen>
      <BoxHeader box={box} />
      {box.status === "preparing" ? (
        box.editError ? <ErrorText>{box.editError}</ErrorText> : <Loading label="正在抠图、生成 3D…" />
      ) : (
        <Section title="盒子码（发给对方）">
          <Text selectable style={styles.code}>{box.code}</Text>
          <Muted>对方改造好、封箱之后，这里会出现「开盒」。</Muted>
        </Section>
      )}
      {box.cutoutUrl ? <Picture uri={box.cutoutUrl} label="抠图" /> : <Picture uri={box.photoUrl} label="原图" />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 44, fontWeight: "700", letterSpacing: 8, textAlign: "center", paddingVertical: 8 },
});
