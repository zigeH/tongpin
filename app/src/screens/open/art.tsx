import type { ReactNode } from "react";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors as C } from "../../theme";

// Static artwork from the 4-open design; positions and sizes are in 390-wide canvas points.

export const Stars = () => (
  <Svg width={390} height={844} viewBox="0 0 390 844" fill={C.cream}>
    {[
      [40, 140, 3], [330, 120, 4], [90, 250, 2.5], [350, 300, 3], [30, 420, 4], [300, 470, 2.5],
      [120, 560, 3], [360, 600, 3.5], [60, 680, 2.5], [250, 720, 3], [200, 90, 2.5],
    ].map(([cx, cy, r]) => (
      <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
    ))}
    <Path d="M270 210l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill={C.sun} />
    <Path d="M70 340l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={C.sun} />
    <Path d="M320 690l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={C.sun} />
  </Svg>
);

export const Orbit = () => (
  <Svg width={300} height={300} viewBox="0 0 300 300" fill="none" stroke={C.ink} strokeWidth={3} strokeLinejoin="round">
    <Path d="M150 6l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill={C.sun} />
    <Circle cx={282} cy={168} r={8} fill={C.croc} />
    <Path d="M30 230l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill={C.orange} />
  </Svg>
);

export const Ball = () => (
  <Svg width={220} height={220} viewBox="0 0 220 220" fill="none" stroke={C.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 110h192a96 96 0 0 1-192 0z" fill={C.orange} />
    <Path d="M40 140c10 22 28 38 52 44" stroke={C.white} strokeWidth={4} opacity={0.6} />
    <Path d="M14 110a96 96 0 0 1 192 0z" fill={C.white} />
    <Path d="M50 76c12-22 32-36 56-40" stroke="#E6DED0" strokeWidth={5} />
    <Rect x={8} y={102} width={204} height={16} rx={8} fill={C.white} />
  </Svg>
);

export const Core = () => (
  <Svg width={80} height={80} viewBox="0 0 80 80" fill={C.cream} stroke={C.sun} strokeWidth={4}>
    <Path d="M40 4l9 27 27 9-27 9-9 27-9-27-27-9 27-9z" />
  </Svg>
);

export const Ring = ({ color }: { color: string }) => (
  <Svg width={400} height={400} viewBox="0 0 400 400" fill="none">
    <Circle cx={200} cy={200} r={190} stroke={color} strokeWidth={10} />
  </Svg>
);

export const Flash = () => (
  <Svg width={200} height={200} viewBox="0 0 200 200">
    <Defs>
      <RadialGradient id="flash" cx="100" cy="100" r="100" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={C.white} stopOpacity={1} />
        <Stop offset="0.5" stopColor={C.cream} stopOpacity={1} />
        <Stop offset="0.72" stopColor={C.cream} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Circle cx={100} cy={100} r={100} fill="url(#flash)" />
  </Svg>
);

const SPARK = "M17 2l4 11 11 4-11 4-4 11-4-11-11-4 11-4z";
export const Twinkle = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 34 34" fill={color} stroke={C.ink} strokeWidth={2.5}>
    <Path d={SPARK} />
  </Svg>
);

const STAR5 = "M20 4l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z";

export type DebrisPiece = { x: number; y: number; r: number; s: number; w: number; h: number; art: ReactNode };

export const DEBRIS: DebrisPiece[] = [
  { x: -150, y: -190, r: -220, s: 1.2, w: 44, h: 44, art: (
    <Svg width={44} height={44} viewBox="0 0 44 44" fill={C.sun} stroke={C.ink} strokeWidth={3} strokeLinejoin="round">
      <Path d="M22 3l6 12 13 2-10 9 3 13-12-7-12 7 3-13-10-9 13-2z" />
    </Svg>
  ) },
  { x: 160, y: -170, r: 160, s: 1.3, w: 64, h: 40, art: (
    <Svg width={64} height={40} viewBox="0 0 64 40" fill="none" stroke={C.ink} strokeWidth={3}>
      <Circle cx={32} cy={20} r={13} fill={C.orange} />
      <Ellipse cx={32} cy={22} rx={30} ry={8} transform="rotate(-15 32 22)" />
    </Svg>
  ) },
  { x: -170, y: 60, r: -120, s: 1.1, w: 44, h: 44, art: (
    <Svg width={44} height={44} viewBox="0 0 44 44" fill={C.cream} stroke={C.ink} strokeWidth={3}>
      <Path d="M30 6a17 17 0 1 0 8 26A14 14 0 0 1 30 6z" />
      <Circle cx={18} cy={22} r={2} fill={C.ink} stroke="none" />
    </Svg>
  ) },
  { x: 150, y: 90, r: 200, s: 1, w: 40, h: 40, art: (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill={C.orange} stroke={C.ink} strokeWidth={3} strokeLinejoin="round">
      <Path d={STAR5} />
    </Svg>
  ) },
  { x: -60, y: 230, r: -300, s: 1.4, w: 60, h: 34, art: (
    <Svg width={60} height={34} viewBox="0 0 60 34" fill={C.white} stroke={C.ink} strokeWidth={3.5}>
      <Path d="M4 30a26 26 0 0 1 52 0z" />
    </Svg>
  ) },
  { x: 80, y: 250, r: 280, s: 1.4, w: 60, h: 34, art: (
    <Svg width={60} height={34} viewBox="0 0 60 34" fill={C.orange} stroke={C.ink} strokeWidth={3.5}>
      <Path d="M4 4h52a26 26 0 0 1-52 0z" />
    </Svg>
  ) },
  { x: 20, y: -250, r: 90, s: 1, w: 30, h: 30, art: (
    <Svg width={30} height={30} viewBox="0 0 30 30" fill={C.croc} stroke={C.ink} strokeWidth={3}>
      <Circle cx={15} cy={15} r={11} />
    </Svg>
  ) },
  { x: -120, y: -60, r: 140, s: 1, w: 36, h: 32, art: (
    <Svg width={36} height={32} viewBox="0 0 36 32" fill={"#E8909A"} stroke={C.ink} strokeWidth={3} strokeLinejoin="round">
      <Path d="M18 29C4 20 2 12 6 7s10-4 12 2c2-6 8-7 12-2s2 13-12 22z" />
    </Svg>
  ) },
  { x: 120, y: -40, r: -160, s: 1, w: 34, h: 34, art: (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none" stroke={C.sun} strokeWidth={4} strokeLinecap="round">
      <Path d="M17 3v28M3 17h28M7 7l20 20M27 7L7 27" />
    </Svg>
  ) },
  { x: -150, y: -20, r: 60, s: 0.8, w: 30, h: 30, art: (
    <Svg width={30} height={30} viewBox="0 0 30 30" fill={C.sun} stroke={C.ink} strokeWidth={3}>
      <Circle cx={15} cy={15} r={9} />
    </Svg>
  ) },
  { x: 40, y: 200, r: -90, s: 1, w: 40, h: 40, art: (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill={C.sun} stroke={C.ink} strokeWidth={3} strokeLinejoin="round">
      <Path d={STAR5} />
    </Svg>
  ) },
];
