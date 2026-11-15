import Svg, { Path } from "react-native-svg";
import { colors, roughCircle, stroke } from "../../theme";

// 盲盒胶囊：上半白、下半是颜色（设计稿 inbox 行左侧 40×40）。
export function CapsuleIcon({ color = colors.orange, size = 40 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={colors.ink} strokeWidth={3} strokeLinejoin="round">
      <Path d="M4 20.3a16 15.7 0 0 1 32 -0.6z" fill={colors.white} />
      <Path d="M4 20.3a16 16.2 0 0 0 32 -0.6z" fill={color} />
    </Svg>
  );
}

// 黄色圆 + 加号（Home 右上角）。
export function PlusIcon({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none" stroke={colors.ink} strokeWidth={stroke.icon} strokeLinecap="round">
      <Path d={roughCircle(22, 22, 19, { seed: 7 })} fill={colors.sun} strokeLinejoin="round" />
      <Path d="M22.3 13.2c-.2 6-.3 12 0 17.8M13 22.4c6-.3 12-.2 18 .1" />
    </Svg>
  );
}

// 返回/关闭用的手绘箭头。
export function BackIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={colors.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.5 6.5c-3.5 2.6-6.2 5-8.4 7.6 2.3 2.6 5 5 8.6 7.4" />
    </Svg>
  );
}
