import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Ball, Core, DEBRIS, Flash, Orbit, Ring, Stars, Twinkle, type DebrisPiece } from "./art";
import { colors as C } from "../../theme";
import { T, ease, loop, track } from "./timeline";

type Clock = { now: SharedValue<number>; tapAt: SharedValue<number> };

function elapsed({ now, tapAt }: Clock) {
  "worklet";
  return tapAt.value < 0 ? -1 : now.value - tapAt.value;
}

const IMPLODE_STOPS = [0, 0.25, 0.4, 0.55, 1];
const IMPLODE_SCALE = [1, 1.08, 1.12, 1.18, 0];
const IMPLODE_ROTATE = [0, -10, 10, -6, 200];

// Everything between the header and the card: the ball, the big bang, and the prize.
export function BigBang({ clock, onTapBall, prize, prizeTouchable }: {
  clock: Clock;
  onTapBall: () => void;
  prize: ReactNode;
  prizeTouchable: boolean;
}) {
  const space = useAnimatedStyle(() => {
    const t = elapsed(clock);
    const { delay, duration } = T.space;
    return {
      opacity: track(t, delay, duration, [0, 0.25, 0.75, 1], [1, 1, 1, 0], ease.out, 0),
      transform: [{ scale: track(t, delay, duration, [0, 0.25, 1], [0, 1, 1], ease.out, 0) }],
    };
  });

  const orbit = useAnimatedStyle(() => {
    const t = elapsed(clock);
    if (t < 0) return { opacity: 1, transform: [{ rotate: `${((clock.now.value % 9000) / 9000) * 360}deg` }, { scale: 1 }] };
    const { delay, duration } = T.implode;
    return {
      opacity: 1,
      transform: [
        { rotate: `${track(t, delay, duration, IMPLODE_STOPS, IMPLODE_ROTATE, ease.implode)}deg` },
        { scale: track(t, delay, duration, IMPLODE_STOPS, IMPLODE_SCALE, ease.implode) },
      ],
    };
  });

  const cap = useAnimatedStyle(() => {
    const t = elapsed(clock);
    if (t < 0) return { transform: [{ rotate: `${loop(clock.now.value, 0, 1800, -4, 4, -4)}deg` }, { scale: 1 }] };
    const { delay, duration } = T.implode;
    return {
      transform: [
        { scale: track(t, delay, duration, IMPLODE_STOPS, IMPLODE_SCALE, ease.implode) },
        { rotate: `${track(t, delay, duration, IMPLODE_STOPS, IMPLODE_ROTATE, ease.implode)}deg` },
      ],
    };
  });

  const core = useAnimatedStyle(() => {
    const t = elapsed(clock);
    const { delay, duration } = T.core;
    return {
      opacity: track(t, delay, duration, [0, 0.4, 1], [0, 1, 0], ease.out, 0),
      transform: [{ scale: track(t, delay, duration, [0, 0.4, 1], [0.2, 1.4, 0.4], ease.out) }],
    };
  });

  const flash = useAnimatedStyle(() => {
    const t = elapsed(clock);
    const { delay, duration } = T.flash;
    return {
      opacity: t < 0 ? 0 : track(t, delay, duration, [0, 1], [0.95, 0], ease.out),
      transform: [{ scale: track(t, delay, duration, [0, 1], [0, 3], ease.out) }],
    };
  });

  const prizeStyle = useAnimatedStyle(() => {
    const t = elapsed(clock);
    const { delay, duration } = T.prize;
    const lift = loop(t, T.float.delay, T.float.period, 0, -10, 0);
    return {
      opacity: Math.min(1, track(t, delay, duration, [0, 1], [0, 1], ease.pop, 0)),
      transform: [
        { translateY: track(t, delay, duration, [0, 1], [30, 0], ease.pop) + lift },
        { scale: track(t, delay, duration, [0, 1], [0.2, 1], ease.pop) },
      ],
    };
  });

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.space, space]}>
        <View style={styles.stars}>
          <Stars />
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.orbit, orbit]}>
        <Orbit />
      </Animated.View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the box"
        onPress={onTapBall}
        style={styles.ballButton}
      >
        <Animated.View style={[styles.cap, cap]}>
          <Ball />
        </Animated.View>
      </Pressable>

      <Animated.View pointerEvents="none" style={[styles.core, core]}>
        <Core />
      </Animated.View>

      {[C.sun, C.orange, C.croc].map((color, i) => (
        <RingLayer key={color} clock={clock} color={color} delay={T.rings[i]} />
      ))}

      <View pointerEvents="none" style={styles.debris}>
        {DEBRIS.map((piece, i) => (
          <DebrisLayer key={i} clock={clock} piece={piece} />
        ))}
      </View>

      <Animated.View pointerEvents="none" style={[styles.flash, flash]}>
        <Flash />
      </Animated.View>

      <TwinkleLayer clock={clock} delay={T.twinkles[0]} size={34} color={C.sun} left={70} top={220} />
      <TwinkleLayer clock={clock} delay={T.twinkles[1]} size={28} color={C.orange} left={300} top={260} />
      <TwinkleLayer clock={clock} delay={T.twinkles[2]} size={24} color={C.croc} left={60} top={400} />

      <Animated.View pointerEvents={prizeTouchable ? "auto" : "none"} style={[styles.prize, prizeStyle]}>
        {prize}
      </Animated.View>
    </>
  );
}

function RingLayer({ clock, color, delay }: { clock: Clock; color: string; delay: number }) {
  const style = useAnimatedStyle(() => {
    const t = elapsed(clock);
    return {
      opacity: t < 0 ? 0 : track(t, delay, T.ringDuration, [0, 1], [1, 0], ease.out),
      transform: [{ scale: track(t, delay, T.ringDuration, [0, 1], [0.05, 1.7], ease.out) }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.ring, style]}>
      <Ring color={color} />
    </Animated.View>
  );
}

function DebrisLayer({ clock, piece }: { clock: Clock; piece: DebrisPiece }) {
  const style = useAnimatedStyle(() => {
    const t = elapsed(clock);
    const { delay, duration } = T.debris;
    const p = track(t, delay, duration, [0, 1], [0, 1], ease.fly);
    return {
      opacity: t < 0 ? 0 : track(t, delay, duration, [0, 0.12, 0.8, 1], [0, 1, 1, 0], ease.fly),
      transform: [
        { translateX: piece.x * p },
        { translateY: piece.y * p },
        { scale: 0.2 + (piece.s - 0.2) * p },
        { rotate: `${piece.r * p}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: piece.w, height: piece.h }, style]}>{piece.art}</Animated.View>;
}

function TwinkleLayer({ clock, delay, size, color, left, top }: {
  clock: Clock;
  delay: number;
  size: number;
  color: string;
  left: number;
  top: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = elapsed(clock);
    return {
      opacity: loop(t, delay, T.twinklePeriod, 0.2, 1, 0),
      transform: [{ scale: loop(t, delay, T.twinklePeriod, 0.7, 1.1, 0.7) }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left, top, zIndex: 3 }, style]}>
      <Twinkle size={size} color={color} />
    </Animated.View>
  );
}

export const PRIZE_FRAME = { left: 55, top: 180, width: 280, height: 290 };

const styles = StyleSheet.create({
  space: {
    position: "absolute",
    left: -305,
    top: -170,
    width: 1000,
    height: 1000,
    borderRadius: 500,
    backgroundColor: C.space,
    overflow: "hidden",
    zIndex: 1,
  },
  stars: { position: "absolute", left: 305, top: 170 },
  orbit: { position: "absolute", left: 45, top: 180, width: 300, height: 300, zIndex: 2 },
  ballButton: { position: "absolute", left: 85, top: 220, width: 220, height: 220, zIndex: 3 },
  cap: { width: 220, height: 220, transformOrigin: "50% 55%" },
  core: { position: "absolute", left: 155, top: 290, width: 80, height: 80, zIndex: 4 },
  ring: { position: "absolute", left: -5, top: 130, width: 400, height: 400, zIndex: 3 },
  debris: { position: "absolute", left: 175, top: 310, width: 40, height: 40, zIndex: 4 },
  piece: { position: "absolute", left: 0, top: 0 },
  flash: { position: "absolute", left: 95, top: 230, width: 200, height: 200, zIndex: 5 },
  prize: { position: "absolute", ...PRIZE_FRAME, zIndex: 6 },
});
