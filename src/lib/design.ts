/**
 * iOS HIG-aligned design tokens for FitKit Mobile.
 *
 * Apple's typography scale, 4pt spacing grid, and platform-appropriate
 * corner radii. Use these instead of ad-hoc magic numbers so spacing
 * and hierarchy stay consistent across screens.
 */
import type { TextStyle, ViewStyle } from 'react-native';

/** 4pt grid. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  '3xl': 32,
  '4xl': 44,
  '5xl': 56,
} as const;

/** iOS Dynamic Type sizes (rounded for legibility). */
export const fontSize = {
  caption2: 11,
  caption1: 12,
  footnote: 13,
  subheadline: 15,
  callout: 16,
  body: 17,
  headline: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
} as const;

/** Standard iOS-style radii. Always pair with `borderCurve: 'continuous'`. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 20,
  pill: 999,
} as const;

/** Touch-target minimum (HIG). */
export const minTouchTarget = 44;

/** Subtle shadow tiers (RN 0.81 shadow* on iOS, elevation on Android). */
export const shadow = {
  subtle: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } satisfies ViewStyle,
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } satisfies ViewStyle,
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } satisfies ViewStyle,
} as const;

/** iOS section-header style — smaller + tighter than UPPERCASE shouting. */
export const sectionHeader = {
  fontSize: fontSize.footnote,
  fontWeight: '600' as TextStyle['fontWeight'],
  letterSpacing: -0.08,
};
