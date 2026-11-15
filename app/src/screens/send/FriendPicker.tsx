import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Id } from "../../lib/backend";
import { colors, fonts, STROKE, useScale } from "./theme";

export type Friend = { userId: Id<"users">; nickname: string; color: string };

// 设计稿里选中的头像外圈是 conic-gradient(orange, sun, croc, orange)；SVG 没有锥形渐变，用 48 段小弧逐段插色近似。
const STOPS = [colors.orange, colors.sun, colors.croc, colors.orange];
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function colorAt(t: number) {
  const x = t * (STOPS.length - 1);
  const i = Math.min(Math.floor(x), STOPS.length - 2);
  return mix(STOPS[i], STOPS[i + 1], x - i);
}

function GradientRing({ size }: { size: number }) {
  const segments = 48;
  const r = size / 2 - 1.5;
  const c = size / 2;
  const point = (a: number) => `${c + r * Math.sin(a)} ${c - r * Math.cos(a)}`;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      {Array.from({ length: segments }, (_, i) => {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1.15) / segments) * Math.PI * 2;
        return <Path key={i} d={`M${point(a0)} A${r} ${r} 0 0 1 ${point(a1)}`} stroke={colorAt(i / segments)} strokeWidth={3.5} fill="none" />;
      })}
    </Svg>
  );
}

function DashedCircle({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - STROKE / 2} stroke={colors.ink} strokeWidth={STROKE} strokeDasharray="5 4" fill="none" />
    </Svg>
  );
}

export function FriendPicker({
  friends,
  selected,
  onToggle,
  onInvite,
  inviteBusy,
}: {
  friends: Friend[];
  selected: ReadonlySet<Id<"users">>;
  onToggle: (id: Id<"users">) => void;
  onInvite: () => void;
  inviteBusy?: boolean;
}) {
  const s = useScale();
  const d = s(54);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(14), paddingRight: s(18) }}>
      {friends.map((f) => {
        const on = selected.has(f.userId);
        return (
          <Pressable
            key={f.userId}
            onPress={() => onToggle(f.userId)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={f.nickname}
            style={[styles.item, { gap: s(4), width: d + s(6) }]}
          >
            <View style={{ width: d, height: d, padding: s(3) }}>
              {on ? <GradientRing size={d} /> : null}
              <View style={[styles.face, { borderRadius: d, backgroundColor: f.color }]}>
                <Text style={[styles.initial, { fontSize: s(17) }]}>{f.nickname.slice(0, 1).toUpperCase()}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={[styles.name, { fontSize: s(12) }, !on && { color: colors.muted }]}>
              {f.nickname}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onInvite}
        disabled={inviteBusy}
        accessibilityRole="button"
        accessibilityLabel="Invite with box code"
        style={[styles.item, { gap: s(4), width: d + s(6) }, inviteBusy && { opacity: 0.5 }]}
      >
        <View style={[styles.invite, { width: d, height: d }]}>
          <DashedCircle size={d} />
          <Text style={[styles.plus, { fontSize: s(24) }]}>+</Text>
        </View>
        <Text style={[styles.name, { fontSize: s(12), color: colors.muted }]}>Invite</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: "center" },
  face: { flex: 1, borderWidth: STROKE, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.heavy, color: colors.ink },
  name: { fontFamily: fonts.bold, color: colors.ink },
  invite: { alignItems: "center", justifyContent: "center" },
  plus: { fontFamily: fonts.body, color: colors.ink },
});
