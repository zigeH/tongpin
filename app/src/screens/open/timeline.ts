import { Easing } from "react-native-reanimated";

type Ease = (x: number) => number;

export const ease = {
  linear: ((x: number) => {
    "worklet";
    return x;
  }) as Ease,
  out: Easing.bezierFn(0, 0, 0.58, 1),
  inOut: Easing.bezierFn(0.42, 0, 0.58, 1),
  implode: Easing.bezierFn(0.5, 0, 0.75, 0),
  fly: Easing.bezierFn(0.15, 0.8, 0.3, 1),
  pop: Easing.bezierFn(0.34, 1.56, 0.64, 1),
  rise: Easing.bezierFn(0.22, 1, 0.36, 1),
};

// A CSS @keyframes track: the timing function applies to each keyframe interval.
// before is the value while the animation has not started yet (no backwards fill).
export function track(t: number, delay: number, duration: number, stops: number[], values: number[], fn: Ease, before?: number) {
  "worklet";
  const p = (t - delay) / duration;
  if (p < 0) return before ?? values[0];
  if (p >= 1) return values[values.length - 1];
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i]) {
      const local = (p - stops[i - 1]) / (stops[i] - stops[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * fn(local);
    }
  }
  return values[values.length - 1];
}

// An infinite ease-in-out 0% → 50% → 0% loop starting at delay; before is shown until then.
export function loop(t: number, delay: number, period: number, from: number, to: number, before: number) {
  "worklet";
  if (t < delay) return before;
  const p = ((t - delay) % period) / period;
  const half = p < 0.5 ? p * 2 : (1 - p) * 2;
  return from + (to - from) * ease.inOut(half);
}

// Timeline from the 4-open design CSS (ms after the tap).
export const T = {
  implode: { delay: 0, duration: 650 },
  core: { delay: 550, duration: 350 },
  space: { delay: 600, duration: 1500 },
  rings: [650, 800, 950],
  ringDuration: 1000,
  debris: { delay: 680, duration: 1250 },
  flash: { delay: 1550, duration: 550 },
  prize: { delay: 1750, duration: 700 },
  float: { delay: 2600, period: 3000 },
  twinkles: [2000, 2400, 2700],
  twinklePeriod: 1400,
  opened: { delay: 2000, duration: 400 },
  card: { delay: 2300, duration: 600 },
  end: 2900,
};

// Elapsed time used for "opened long ago": every one-shot track is at its end.
export const LONG_AGO = 1e7;
