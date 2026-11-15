import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, radii, stroke } from "../../theme";

type Tail = "bottomLeft" | "bottomRight" | "topLeft" | "topRight";

// Bobo 的对话气泡：白底 ink 描边、手写字，尾巴那个角圆角 6。
export function Bubble({ children, tail = "bottomLeft", size = 24, style }: { children: ReactNode; tail?: Tail; size?: number; style?: StyleProp<ViewStyle> }) {
  const corner = {
    bottomLeft: { borderBottomLeftRadius: radii.bubbleTail },
    bottomRight: { borderBottomRightRadius: radii.bubbleTail },
    topLeft: { borderTopLeftRadius: radii.bubbleTail },
    topRight: { borderTopRightRadius: radii.bubbleTail },
  }[tail];
  return (
    <View style={[styles.bubble, corner, style]}>
      {typeof children === "string" ? <Text style={[styles.text, { fontSize: size, lineHeight: size * 1.05 }]}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: stroke.width,
    borderColor: colors.ink,
    borderRadius: radii.bubble,
  },
  text: { fontFamily: fonts.hand, color: colors.ink },
});
