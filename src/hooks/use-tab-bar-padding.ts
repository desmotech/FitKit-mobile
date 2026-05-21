/**
 * `useTabBarPadding` — the canonical "how much bottom padding does this
 * scroll surface need to clear the tab bar dock?" calculation.
 *
 * Anywhere inside `(tabs)/*` that uses `<ScrollView contentContainerStyle>`
 * (or pads a sticky CTA above the dock) should call this instead of
 * recomputing `49 + insets.bottom + N` by hand. NativeTabs renders an
 * iOS-style tab bar (~49pt) above the home indicator; the safe-area
 * inset accounts for the home indicator itself.
 *
 * Pass `extra` for additional breathing room beyond clearing the dock.
 * Default 24 covers most cases. Tighten to 0 for sticky overlays anchored
 * exactly to the top of the dock; widen for ScrollViews ending in
 * destructive buttons that need a comfortable thumb-zone.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** iOS tab-bar height (excluding the home indicator inset). */
export const TAB_BAR_HEIGHT = 49;

/**
 * Total bottom padding needed to scroll content fully clear of the
 * floating tab bar dock. Returns a number you can drop straight into
 * a style: `contentContainerStyle={{ paddingBottom: useTabBarPadding() }}`.
 */
export function useTabBarPadding(extra = 24): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + extra;
}

/**
 * Just the safe-area-aware tab-bar position (no extra). Useful for
 * sticky CTAs that should sit immediately above the dock — e.g. the
 * "Start workout" button on the workout detail.
 *   bottom: useTabBarTop()
 */
export function useTabBarTop(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom;
}
