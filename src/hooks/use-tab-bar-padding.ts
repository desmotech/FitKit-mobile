/**
 * `useTabBarPadding` — the canonical "how much bottom padding does this
 * scroll surface need to clear the tab bar dock?" calculation.
 *
 * Anywhere inside `(tabs)/*` that uses `<ScrollView contentContainerStyle>`
 * (or pads a sticky CTA above the dock) should call this instead of
 * recomputing the clearance by hand.
 *
 * The dock is measured, never assumed. This used to add a hardcoded 49pt
 * on top of `insets.bottom`, which was wrong on both platforms:
 *
 *   iOS — expo-router wraps every native tab screen in its own
 *   `SafeAreaProvider` (NativeTabsView), so `insets.bottom` read inside a
 *   tab is the *tab screen's* inset, which UIKit already sets to the tab
 *   bar plus the home indicator (83pt on an iPhone 17 Pro, iOS 26). Adding
 *   49 on top left ~49pt of phantom padding under every list. Reading the
 *   inset also means the iOS 26 floating glass bar, iPad's wider bar and
 *   the 32pt landscape bar are all correct for free.
 *
 *   Android — the native tab bar is a sibling of the content, not an
 *   overlay: the scroll view already ends where the bar begins, and the bar
 *   owns the gesture inset below it. Nothing needs adding at all, and
 *   `insets.bottom` there is the window's nav-bar inset, which the bar has
 *   already accounted for.
 *
 * Pass `extra` for breathing room beyond clearing the dock. Default 24
 * covers most cases. Tighten to 0 for sticky overlays anchored exactly to
 * the top of the dock; widen for ScrollViews ending in destructive buttons
 * that need a comfortable thumb-zone.
 */
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The dock's own height for the current screen — tab bar + home indicator
 * on iOS, zero on Android (see the module note). Screens outside `(tabs)`
 * read the root inset instead, which is exactly right: no tab bar there,
 * just the home indicator.
 */
function useDockHeight(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom : 0;
}

/**
 * Total bottom padding needed to scroll content fully clear of the
 * tab bar dock. Returns a number you can drop straight into
 * a style: `contentContainerStyle={{ paddingBottom: useTabBarPadding() }}`.
 */
export function useTabBarPadding(extra = 24): number {
  return useDockHeight() + extra;
}

/**
 * Just the dock height (no extra). Useful for sticky CTAs that should sit
 * immediately above it — e.g. the "Start workout" button on the workout
 * detail:
 *   bottom: useTabBarTop()
 */
export function useTabBarTop(): number {
  return useDockHeight();
}
