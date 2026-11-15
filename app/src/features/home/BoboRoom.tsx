import { Animated, Image, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Bubble, bobo } from "../../components/ui";
import { colors, roughRect, stroke, useLoop } from "../../theme";

// 设计稿 1-home 的"Bobo 的房间"：346×330 画布，按 k 缩放。
export function BoboRoom({ k, message }: { k: number; message: string }) {
  const breathe = useLoop(3200);
  const sway = useLoop(4000);
  const s = (n: number) => n * k;
  return (
    <View style={{ width: s(346), height: s(330) }}>
      <Svg width={s(346)} height={s(330)} viewBox="0 0 346 330" fill="none" stroke={colors.ink} strokeWidth={stroke.icon} strokeLinecap="round" strokeLinejoin="round" style={StyleSheet.absoluteFill}>
        <Path d={roughRect(346, 330, 18, { inset: 8, seed: 7, amp: 1.4 })} fill={colors.cream} />
        <Path d="M236.4 40.2c25.3-.6 50.6-.3 75.8 .3.4 21.2.2 42.5-.2 63.6-25.2.3-50.5.2-75.6-.3-.6-21.1-.5-42.4 0-63.6z" fill={colors.sky} />
        <Path d="M274.2 40.5c.4 21.2.2 42.4-.3 63.4M236.5 72.3c25.4-.5 50.7-.2 75.6.2" />
        <Path d="M228 34c10 14 12 34 4 76M320 34c-10 14-12 34-4 76" stroke={colors.orange} strokeWidth={5} />
        <Path d="M30 250h286" strokeDasharray="2 10" opacity={0.4} />
      </Svg>
      <Animated.View
        style={{
          position: "absolute",
          left: s(30),
          top: s(70),
          width: s(250),
          height: s(250),
          transformOrigin: "50% 92%",
          transform: [
            { scaleX: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
            { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
          ],
        }}
      >
        <Image source={bobo.home} style={{ width: s(250), height: s(250) }} accessibilityLabel="Bobo the croc relaxing at home with a mug" />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          left: s(22),
          top: s(22),
          transformOrigin: "50% 100%",
          transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }) }],
        }}
      >
        <Bubble tail="bottomLeft" size={24 * k}>
          {message}
        </Bubble>
      </Animated.View>
    </View>
  );
}
