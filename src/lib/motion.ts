/**
 * Taikan motion system — shared spring/timing tokens so microinteractions
 * feel like one app instead of 50 ad-hoc animations.
 *
 * Principle (from the Fuse / "beautiful RN app" reference set): physics over
 * duration. Reach for a spring for anything the finger drives or that should
 * feel alive (press, selection slide, expand). Reserve timing for opacity
 * crossfades where a spring would look mushy.
 *
 * Usage:
 *   scale.value = withSpring(0.96, spring.press);
 *   x.value = withSpring(target, spring.slide);
 *   opacity.value = withTiming(1, timing.fade);
 */
import { Easing } from 'react-native-reanimated';

/** Spring presets (Reanimated `withSpring` configs). */
export const spring = {
  /** Snappy press feedback — buttons, cells. */
  press: { mass: 0.5, damping: 14, stiffness: 320 },
  /** The selection indicator sliding between days, tabs, segments. */
  slide: { mass: 0.7, damping: 18, stiffness: 220 },
  /** Expand / collapse heights and reveals — a little overshoot. */
  expand: { mass: 0.9, damping: 16, stiffness: 180 },
  /** Soft, settled — sheets, docks, large layout shifts. */
  gentle: { mass: 1, damping: 22, stiffness: 140 },
  /** Energetic pop — PRs, celebrations, "today" pulse. */
  bouncy: { mass: 0.6, damping: 9, stiffness: 200 },
} as const;

/** Timing presets (`withTiming` configs). */
export const timing = {
  fast: { duration: 140, easing: Easing.out(Easing.quad) },
  fade: { duration: 220, easing: Easing.out(Easing.cubic) },
  slow: { duration: 360, easing: Easing.out(Easing.cubic) },
  /** Standard ease for entrances. */
  enter: { duration: 280, easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
} as const;

/** Press-scale targets — keep consistent across all tappable surfaces. */
export const pressScale = {
  cell: 0.97,
  card: 0.98,
  button: 0.96,
  chip: 0.94,
} as const;

/** Stagger step (ms) for orchestrated list reveals. */
export const STAGGER = 32;
