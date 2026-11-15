import { useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radii, roughRect, stroke } from "../../theme";

// 手绘描边卡片：背后一层按尺寸生成的抖动圆角矩形。
export function RoughCard({
  children,
  fill = colors.white,
  radius = radii.card,
  strokeWidth = stroke.icon,
  seed = 7,
  style,
}: {
  children?: ReactNode;
  fill?: string;
  radius?: number;
  strokeWidth?: number;
  seed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View style={style} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={roughRect(size.w, size.h, radius, { seed, inset: strokeWidth / 2 + 1 })}
            fill={fill}
            stroke={colors.ink}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
