/**
 * FKGlassSurface — one chrome surface, two renderings.
 *
 * On iOS 26 this is a real `GlassView` (UIVisualEffectView Liquid Glass), so
 * the app's chrome buttons refract, specular-highlight and morph under the
 * finger exactly like system toolbar controls. Everywhere else — iOS < 26,
 * Android, Reduce Transparency — it falls back to the translucent fill +
 * hairline border the app used before, so nothing regresses.
 *
 * Two caveats the Liquid Glass path imposes, both handled here:
 *  1. `opacity: 0` on a GlassView *or any ancestor* kills the effect
 *     outright, so press feedback floors at 0.6 and never fades out.
 *  2. Glass has no border of its own — the hairline is fallback-only; drawing
 *     one over real glass reads as a sticker.
 *
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFKColors } from './colors';

/**
 * Cached once — the native flag can't change during a session.
 *
 * Guarded: `isLiquidGlassAvailable()` reaches for the native ExpoGlassEffect
 * module, which throws if the running binary predates the dependency (a dev
 * client built before it was added). That would be an import-time crash on
 * every screen, so an absent module just means "no glass".
 */
export const LIQUID_GLASS = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

export function FKGlassSurface({
  children,
  radius,
  tint,
  interactive = true,
  pressed = false,
  style,
}: {
  children?: ReactNode;
  /** Corner radius. Pass half the height for a circle/capsule. */
  radius: number;
  /** Tint for filled affordances (e.g. the brand-teal check-in button).
   *  Renders as tinted glass on iOS 26, a solid fill on the fallback. */
  tint?: string;
  /** Native Liquid Glass press response. iOS 26 only. */
  interactive?: boolean;
  /** Fallback press feedback — ignored when real glass handles it. */
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useFKColors();
  const isDark = colors.isDark;

  const shape: ViewStyle = {
    borderRadius: radius,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={tint}
        isInteractive={interactive}
        style={[shape, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        shape,
        {
          backgroundColor:
            tint ?? (isDark ? 'rgba(58,70,78,0.72)' : 'rgba(255,255,255,0.82)'),
          borderWidth: tint ? 0 : StyleSheet.hairlineWidth,
          borderColor: isDark
            ? 'rgba(255,255,255,0.22)'
            : 'rgba(255,255,255,0.92)',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
