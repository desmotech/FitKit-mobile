import { useColorScheme } from 'nativewind';
import { useWindowDimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * Atmospheric ambient backdrop — the "liquid glass" foundation.
 *
 * An Ocean base gradient with three soft, blurred color orbs (teal · slate ·
 * mint) bleeding in from the corners, so the translucent glass panels on top
 * have something to refract. Ported from the design system's PhoneFrame +
 * THEMES tokens (taikan-glass-ds.jsx).
 *
 * Rendered with SVG radial gradients (crisp + cheap — no faux-blur stacks)
 * into an absolute fill. Place as the first child of a flex-1 screen root and
 * keep the root transparent so this shows through.
 */
const ORBS = {
  light: {
    // Ocean light ground with a cool slate drift — same family as the web app.
    base: ['#F6F8FA', '#EEF2F6', '#F3F6F9'] as const,
    highlight: '#D9EDE9', // teal mist, top-right sheen
    orb1: '#0E8C8C', // teal
    orb1Op: 0.3,
    orb2: '#3D5A70', // slate (was the warm orange)
    orb2Op: 0.14,
    orb3: '#2E7A4D', // mint (was gold)
    orb3Op: 0.14,
  },
  dark: {
    // The marketing "band": deep teal-navy, lifting toward the raised card tone.
    base: ['#0A2531', '#07202B', '#051A23'] as const,
    highlight: '#123845',
    orb1: '#2AB8B8',
    orb1Op: 0.24,
    orb2: '#94E3DE',
    orb2Op: 0.12,
    orb3: '#B0E5C4',
    orb3Op: 0.1,
  },
};

export function FKAmbientBackdrop() {
  const { colorScheme } = useColorScheme();
  const { width: W, height: H } = useWindowDimensions();
  const c = colorScheme === 'dark' ? ORBS.dark : ORBS.light;

  return (
    <Svg
      width={W}
      height={H}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Defs>
        {/* Base wash — ~162deg (mostly vertical, slight horizontal drift). */}
        <LinearGradient
          id="fk-base"
          x1="0"
          y1="0"
          x2={W * 0.3}
          y2={H}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={c.base[0]} />
          <Stop offset="0.55" stopColor={c.base[1]} />
          <Stop offset="1" stopColor={c.base[2]} />
        </LinearGradient>
        {/* Top-right sheen (the design's radial highlight). */}
        <RadialGradient
          id="fk-hi"
          cx={W * 0.78}
          cy={-H * 0.05}
          r={W * 0.95}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={c.highlight} stopOpacity={0.55} />
          <Stop offset="0.6" stopColor={c.highlight} stopOpacity={0} />
        </RadialGradient>
        {/* Orb 1 — teal, top-right corner. */}
        <RadialGradient
          id="fk-orb1"
          cx={W * 1.02}
          cy={-24}
          r={170}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={c.orb1} stopOpacity={c.orb1Op} />
          <Stop offset="1" stopColor={c.orb1} stopOpacity={0} />
        </RadialGradient>
        {/* Orb 2 — warm, mid-left. */}
        <RadialGradient
          id="fk-orb2"
          cx={-40}
          cy={H * 0.5}
          r={180}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={c.orb2} stopOpacity={c.orb2Op} />
          <Stop offset="1" stopColor={c.orb2} stopOpacity={0} />
        </RadialGradient>
        {/* Orb 3 — gold, bottom-right. */}
        <RadialGradient
          id="fk-orb3"
          cx={W * 0.95}
          cy={H * 0.96}
          r={150}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={c.orb3} stopOpacity={c.orb3Op} />
          <Stop offset="1" stopColor={c.orb3} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={W} height={H} fill="url(#fk-base)" />
      <Rect width={W} height={H} fill="url(#fk-hi)" />
      <Rect width={W} height={H} fill="url(#fk-orb1)" />
      <Rect width={W} height={H} fill="url(#fk-orb2)" />
      <Rect width={W} height={H} fill="url(#fk-orb3)" />
    </Svg>
  );
}
