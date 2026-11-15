import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BoxView } from "../../lib/backend";
import { Bubble, Button, HandText, NamePill, bobo } from "../../components/ui";
import { colors, fonts, sizes, stroke, useLoop, useScale } from "../../theme";

const DURATION = 5000;
const walkEase = Easing.bezier(0.3, 0, 0.3, 1);
const doorEase = Easing.inOut(Easing.ease);

// 设计稿 3-receive：B 改好封箱寄回，Bobo 从门里抱着盒子走进来。
export function ArrivedScreen({ box }: { box: BoxView }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useScale();
  const k = Math.min((width - sizes.gutter * 2) / 346, (height / 844) * 1.02, 1.15);
  const s = (n: number) => n * k;
  const who = box.receiverNickname ?? "A friend";

  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    const anim = Animated.timing(t, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: true });
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) t.setValue(1);
      else anim.start();
    });
    return () => {
      cancelled = true;
      anim.stop();
    };
  }, [t]);

  const step = useLoop(700);
  const walking = t.interpolate({ inputRange: [0, 0.36, 0.4], outputRange: [1, 1, 0], extrapolate: "clamp" });
  const stepAmount = Animated.multiply(step, walking);
  const walkX = t.interpolate({ inputRange: [0, 0.38, 1], outputRange: [s(250), 0, 0], easing: walkEase, extrapolate: "clamp" });
  const doorScale = t.interpolate({ inputRange: [0, 0.06, 0.14, 0.34, 0.44, 1], outputRange: [1, 1, 0.35, 0.35, 1, 1], easing: doorEase, extrapolate: "clamp" });
  const sayOpacity = t.interpolate({ inputRange: [0, 0.4, 0.48, 1], outputRange: [0, 0, 1, 1], extrapolate: "clamp" });
  const sayY = t.interpolate({ inputRange: [0, 0.4, 0.48, 1], outputRange: [8, 8, 0, 0], easing: Easing.out(Easing.ease), extrapolate: "clamp" });
  const sayScale = t.interpolate({ inputRange: [0, 0.4, 0.48, 1], outputRange: [0.9, 0.9, 1, 1], easing: Easing.out(Easing.ease), extrapolate: "clamp" });

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={[styles.page, { paddingTop: insets.top + 2 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={close} style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <NamePill name={who} color={box.receiverColor} label={`From ${who}`} />
        <View style={styles.close} />
      </View>

      <View style={{ marginTop: 22 * k, alignItems: "center" }}>
        <HandText size={42 * Math.min(k, 1)} style={styles.center}>
          A box just arrived!
        </HandText>
        <Text style={styles.sub}>{who} remixed your box and sent it back.</Text>
      </View>

      <View style={{ marginTop: 26 * k, width: s(346), height: s(380), alignSelf: "center" }}>
        <Svg width={s(346)} height={s(380)} viewBox="0 0 346 380" fill="none" stroke={colors.ink} strokeWidth={stroke.icon} strokeLinecap="round" strokeLinejoin="round" style={StyleSheet.absoluteFill}>
          <Path d="M246.3 60.2c28.6-.5 57.2-.3 85.6.2.5 89.9.3 179.8-.2 269.6-28.5.4-57 .3-85.4-.2-.5-89.8-.4-179.7 0-269.6z" fill={colors.cream} />
          <Path d="M4 330.4c112.6-.8 225.3-.6 338-.2" />
          <Path d="M60 330c20-8 40-8 60 0M150 330c14-6 28-6 42 0" stroke={colors.croc} strokeWidth={4} />
        </Svg>
        <Animated.View style={{ position: "absolute", left: s(246), top: s(60), width: s(86), height: s(270), transformOrigin: "0% 50%", transform: [{ scaleX: doorScale }] }}>
          <Svg width={s(86)} height={s(270)} viewBox="0 0 86 270" fill="none" stroke={colors.ink} strokeWidth={stroke.icon} strokeLinejoin="round">
            <Path d="M2.3 2.2c26.6-.4 53.1-.3 79.6.2.4 88.5.3 177-.2 265.4-26.5.4-53 .3-79.4-.2-.4-88.4-.4-176.9 0-265.4z" fill={colors.wood} />
            <Circle cx={16} cy={140} r={5} fill={colors.sun} />
            <Path d="M16.2 24.3c18-.4 36-.2 53.8.2.3 23.2.2 46.4-.2 69.5-17.9.3-35.8.2-53.6-.2-.4-23.1-.3-46.3 0-69.5z" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: "absolute", left: s(40), top: s(120), width: s(220), height: s(220), transform: [{ translateX: walkX }] }}>
          <Animated.View
            style={{
              transform: [
                { translateY: stepAmount.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                { rotate: stepAmount.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }) },
              ],
            }}
          >
            <Image source={bobo.hold} style={{ width: s(220), height: s(220) }} accessibilityLabel="Bobo carrying the box in its arms" />
          </Animated.View>
        </Animated.View>
        <Animated.View style={{ position: "absolute", left: s(10), top: s(52), opacity: sayOpacity, transform: [{ translateY: sayY }, { scale: sayScale }] }}>
          <Bubble tail="bottomRight" size={26 * k}>
            {"For you!\nSpecial delivery"}
          </Bubble>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom - 8, 12) }]}>
        <Button title="Take the box" onPress={() => router.replace(`/box/${box._id}`)} />
        <Button title="Save it for later" kind="ghost" onPress={close} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: sizes.gutter },
  header: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { height: 44, minWidth: 44, justifyContent: "center" },
  closeText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  center: { textAlign: "center" },
  sub: { marginTop: 8, fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: "center" },
  footer: { marginTop: "auto", gap: 2 },
});
