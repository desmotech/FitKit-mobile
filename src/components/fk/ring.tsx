/**
 * FKRing — circular progress ring with the percentage stamped in the middle.
 *
 * Ported from the design system's `Ring` primitive (taikan-glass-ds.jsx):
 * a faint full-circle track + a rounded primary arc, the numeric label in
 * DM Mono (numerals only, so no Hebrew-fallback concern).
 */
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

export interface FKRingProps {
  /** 0–100. Clamped. */
  pct: number;
  size?: number;
  /** Stroke width of both track and arc. */
  sw?: number;
  /** Arc + label color. */
  color: string;
  /** Track (unfilled) color. */
  track: string;
  /** Override the centered label. Defaults to the rounded percentage. */
  label?: string | number;
}

export function FKRing({
  pct,
  size = 46,
  sw = 4,
  color,
  track,
  label,
}: FKRingProps) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const mid = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={mid} cy={mid} r={r} fill="none" stroke={track} strokeWidth={sw} />
      <Circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${mid} ${mid})`}
      />
      <SvgText
        x={mid}
        y={mid}
        fill={color}
        fontSize={size * 0.28}
        fontFamily="Assistant-Medium"
        fontWeight="500"
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {label ?? Math.round(clamped)}
      </SvgText>
    </Svg>
  );
}
