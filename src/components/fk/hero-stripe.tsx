import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

/**
 * Hero stripe — port of the redesign's `fk-hero-stripe` class.
 * Linear gradient base (deep teal → primary teal in light, deep navy → secondary
 * teal in dark) with a 45° repeating-line stripe overlay at 6%/4% white opacity.
 */
const LIGHT_COLORS: [string, string] = ['#0D6B6B', '#0E8C8C'];
const DARK_COLORS: [string, string] = ['#0A1E3D', '#0D3060'];

interface HeroStripeProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function HeroStripe({ children, style }: HeroStripeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const stripeAlpha = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)';

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id="stripe"
            x={0}
            y={0}
            width={18}
            height={18}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={18} stroke={stripeAlpha} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#stripe)" />
      </Svg>
      {children}
    </View>
  );
}
