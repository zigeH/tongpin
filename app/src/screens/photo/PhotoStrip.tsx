import { useQuery } from "convex/react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api, type Id } from "../../lib/backend";
import { useProfile } from "../../lib/session";
import { BodyText } from "../../components/ui";
import { colors } from "../../theme";
import { Polaroid } from "../remix/parts";

// 盒子里的合影：小拍立得横排，写着谁拍的。没有合影时不占位置。
export function PhotoStrip({ boxId, size = 72 }: { boxId: Id<"boxes">; size?: number }) {
  const { userId } = useProfile();
  const shots = useQuery(api.boxes.shots, { boxId, viewerId: userId });
  if (!shots || shots.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <BodyText size={13} weight="heavy" color={colors.muted}>
        Photos with it
      </BodyText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shots.map((shot, i) => (
          <Polaroid key={shot._id} uri={shot.url} caption={shot.userId === userId ? "me" : shot.nickname} size={size} rotate={i % 2 === 0 ? -3 : 3} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
});
