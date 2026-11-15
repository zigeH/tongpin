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
  stage: "#F1ECE2",
  stageLine: "#CFC6B8",
  stageShadow: "#E3DACB",
  danger: "#D9534F",
};

export const fonts = {
  hand: "Gaegu_700Bold",
  body: "Nunito_500Medium",
  bold: "Nunito_700Bold",
  heavy: "Nunito_800ExtraBold",
};

export const STROKE = 2.5;

// 设计稿画布 390 宽，其他 iPhone 按宽度等比缩放（上限 1.15，避免大屏过大）。
export function useScale() {
  const { width } = useWindowDimensions();
  const k = Math.min(width / 390, 1.15);
  return (n: number) => Math.round(n * k * 2) / 2;
}
