import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

// 设计稿里的循环动画（breathe / sway / blink / step）：0→1→0 来回，ease-in-out。
export function useLoop(duration: number, { delay = 0 } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced || cancelled) return;
      const ease = Easing.inOut(Easing.sin);
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: duration / 2, easing: ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: duration / 2, easing: ease, useNativeDriver: true }),
        ]),
      );
      if (delay) setTimeout(() => !cancelled && anim?.start(), delay);
      else anim.start();
    });
    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [delay, duration, v]);
  return v;
}

// 一次性 0→1 的进场动画。
export function useEnter(duration: number, { delay = 0, easing = Easing.bezier(0.3, 0, 0.3, 1) } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) return v.setValue(1);
      anim = Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: true });
      anim.start();
    });
    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [delay, duration, easing, v]);
  return v;
}
