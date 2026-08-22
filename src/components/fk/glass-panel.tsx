import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

/**
 * Glass panel — translucent fill + 1px white-5% hairline border.
 *
 * `mode` controls whether we mount a real `BlurView` (for chrome surfaces:
 * floating header, sticky CTAs, dock) or just a translucent fill (for inline
 * cards, where backdrop-blur per element is too expensive on long lists).
 */
type GlassMode = 'fill' | 'blur';

interface FKGlassPanelProps {
  children?: ReactNode;
  className?: string;
  mode?: GlassMode;
  /** Border radius. Default 20. Pass 0 to disable. */
  radius?: number;
  /** Glass tint intensity for blur mode, 0-100. Default 60. */
  intensity?: number;
  style?: ViewStyle | ViewStyle[];
}

export function FKGlassPanel({
  children,
  className,
  mode = 'fill',
  radius = 20,
  intensity = 60,
  style,
}: FKGlassPanelProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Translucent "liquid glass" fill over the ambient backdrop (orbs +
  // gradient) so panels refract what's behind them. The bright edge stands in
  // for CSS's inset top-highlight, which RN can't render.
  const fillBg = isDark ? 'rgba(18,56,69,0.72)' : 'rgba(255,255,255,0.82)';
  const borderCol = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.92)';

  const sharedStyle: ViewStyle = {
    borderRadius: radius,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: borderCol,
    overflow: 'hidden',
  };

  // BlurView only on iOS — Android's blur is unreliable. Android falls back
  // to the translucent fill regardless of `mode`.
  if (mode === 'blur' && Platform.OS === 'ios') {
    return (
      <BlurView
        tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
        intensity={intensity}
        className={className}
        style={[sharedStyle, style as ViewStyle]}
      >
        {/* Tint overlay so the blur picks up the brand-tuned hue. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(12,43,56,0.40)' : 'rgba(255,255,255,0.30)',
          }}
        />
        {children}
      </BlurView>
    );
  }

  return (
    <View
      className={className}
      style={[sharedStyle, { backgroundColor: fillBg }, style as ViewStyle]}
    >
      {/* Bright top edge — the design's inset highlight, our depth cue (RN
          can't do inset box-shadow, and overflow:hidden clips drop shadows). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: radius,
          right: radius,
          height: 1,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.16)'
            : 'rgba(255,255,255,0.85)',
        }}
      />
      {children}
    </View>
  );
}
