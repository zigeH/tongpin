import { useWindowDimensions } from "react-native";

export const colors = {
  paper: "#FDFBF4",
  ink: "#2B2420",
  muted: "#7A6F66",
  croc: "#7CC35A",
  orange: "#F07B2A",
  sun: "#F6C744",
  cream: "#FFF3D6",
  space: "#2E2B4F",
  white: "#FFFFFF",
  sky: "#DDEFF5",
  wood: "#D9A066",
  danger: "#C8402F",
} as const;

export const fonts = {
  hand: "Gaegu_700Bold",
  body: "Nunito_500Medium",
  bold: "Nunito_700Bold",
  heavy: "Nunito_800ExtraBold",
} as const;

export const stroke = { width: 2.5, icon: 3.5 } as const;

export const radii = { row: 20, card: 24, cardLg: 28, bubble: 18, bubbleTail: 6, button: 29, pill: 999 } as const;

export const sizes = { button: 58, hitTarget: 44, gutter: 22 } as const;

export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;

// 设计稿画布 390×844：按屏宽等比缩放，限制在 0.85–1.15 之间，避免大屏上字过大。
export function useScale() {
  const { width, height } = useWindowDimensions();
  const k = Math.min(1.15, Math.max(0.85, width / DESIGN_WIDTH));
  return { k, s: (n: number) => Math.round(n * k * 2) / 2, width, height };
}

export const theme = { colors, fonts, stroke, radii, sizes };

export { roughRect, roughCircle } from "./rough";
export { useLoop, useEnter } from "./motion";
