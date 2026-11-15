import { useFonts } from "expo-font";
import { Gaegu_700Bold } from "@expo-google-fonts/gaegu/700Bold";
import { Nunito_500Medium } from "@expo-google-fonts/nunito/500Medium";
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";

export function useSendFonts(): boolean {
  const [loaded, error] = useFonts({ Gaegu_700Bold, Nunito_500Medium, Nunito_700Bold, Nunito_800ExtraBold });
  return loaded || error !== null;
}
