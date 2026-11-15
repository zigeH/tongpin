import { Animated, Image, KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bubble, HandText, Muted, bobo } from "../../components/ui";
import { RegisterForm } from "../RegisterForm";
import { colors, sizes, useLoop, useScale } from "../../theme";

// 还没注册：Bobo 打招呼 + 起昵称。
export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { k } = useScale();
  const breathe = useLoop(3200);
  const sway = useLoop(4000);
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.page, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <HandText size={40}>Bobo's boxes</HandText>
      <View style={styles.stage}>
        <Animated.View style={{ transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ["-3deg", "3deg"] }) }], transformOrigin: "50% 100%", alignSelf: "flex-start" }}>
          <Bubble tail="bottomLeft" size={26 * k}>
            {"Hi, I'm Bobo!\nWhat should I call you?"}
          </Bubble>
        </Animated.View>
        <Animated.View
          style={{
            alignSelf: "center",
            transformOrigin: "50% 92%",
            transform: [{ scaleX: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }, { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
          }}
        >
          <Image source={bobo.home} style={{ width: 230 * k, height: 230 * k }} accessibilityLabel="Bobo the croc waving hello" />
        </Animated.View>
      </View>
      <View style={styles.form}>
        <RegisterForm />
        <Muted style={styles.hint}>Type your username to log in. New name? We'll make you an account.</Muted>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: sizes.gutter },
  stage: { flex: 1, justifyContent: "center", gap: 4 },
  form: { gap: 12 },
  hint: { textAlign: "center" },
});
