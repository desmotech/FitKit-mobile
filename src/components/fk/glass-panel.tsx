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

  // Solid fill — the ambient backdrop is off for now, so translucency
  // would just look dimmer with no atmospheric payoff.
  const fillBg = isDark ? '#112240' : '#FFFFFF';
  const borderCol = isDark ? '#1E3A5F' : '#E2E8F0';

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
            backgroundColor: isDark ? 'rgba(17,34,64,0.40)' : 'rgba(255,255,255,0.30)',
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
      {children}
    </View>
  );
}
