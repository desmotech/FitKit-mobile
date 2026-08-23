/**
 * Resolved hex equivalents of the FK design tokens for the active theme.
 * Reanimated and inline RN styles can't parse `hsl(var(--token))`, so any
 * `style={{ ... }}` that needs a theme-aware colour reads from here.
 *
 * Lives in its own module (not the fk barrel) so leaf components like
 * nav-button and date-rail can import it without a circular import through
 * index.tsx.
 */
import { useColorScheme } from 'nativewind';
import { useMemo } from 'react';

export const FK_LIGHT = {
  card: '#FFFFFF',
  foreground: '#0D1B2A',
  background: '#F6F8FA', // Ocean light — same ground as usetaikan.com / web
  muted: '#EEF2F6',
  mutedFg: '#4A5A6E', // 6.6:1 on ground — AA at any size
  subtleFg: '#6B7A8C', // 4.1:1 — AA-large only (captions, meta)
  secondary: '#EEF2F6',
  secondaryFg: '#0E8C8C',
  border: '#DCE3EA',
  borderStrong: '#C3CFDA',
  // #0B7575, not the raw brand #0E8C8C: white on #0E8C8C is 4.08:1, which
  // fails AA for the labels and icons that sit on primary-filled surfaces
  // (buttons, own-message bubbles). #0B7575 is 5.50:1 filled.
  primary: '#0B7575', // brand teal, AA-safe as a fill
  brandTeal: '#0E8C8C', // the raw identity teal — graphics only, never behind text
  primaryText: '#0A6E6E', // darker teal for small text (5.7:1 on ground)
  primaryPress: '#094F4F', // solid-CTA pressed fill
  onPrimary: '#FFFFFF', // ink on a primary-filled surface (5.50:1)
  // The tinted-primary tile: icon plates, empty-state tiles, badge fills.
  primarySoft: 'rgba(14,140,140,0.10)',
  primaryEdge: 'rgba(14,140,140,0.28)',
  // Violet — the secondary action (brand kit v3.1's fourth colour). A step
  // below primary, not an alternative: teal stays the primary path.
  violet: '#7A4BE0', // brand violet — fill / CTA (5.37:1 with white)
  violetText: '#6C43D8', // violet as small text on the ground (5.75:1)
  violetPress: '#5E37C4', // pressed fill (7.45:1 with white)
  onViolet: '#FFFFFF', // ink on a violet-filled surface
  violetSoft: 'rgba(122,75,224,0.10)',
  violetEdge: 'rgba(122,75,224,0.28)',
  destructive: '#B84A40', // the ONE destructive red
  success: '#2E7A4D', // mint — positive / highlight (4.9:1 on ground)
  warning: '#A8792F', // amber — attention, AA-large only
  info: '#3D5A70', // slate — neutral status (6.8:1)
  energy: '#2E7A4D', // highlight accent == mint (no volt in the Ocean system)
  energyFg: '#FFFFFF',
} as const;

export const FK_DARK = {
  card: '#0C2B38', // band-raised
  foreground: '#EAF2F4', // ink on band — 6.0:1
  background: '#07202B', // the marketing "band" teal-navy
  muted: '#123845',
  mutedFg: '#C8D9DF', // secondary ink on band — 4.65:1
  subtleFg: '#8FA7B3',
  secondary: '#123845',
  secondaryFg: '#EAF2F4',
  border: '#2B424B', // rgba(234,242,244,0.16) flattened on band
  borderStrong: '#3A5560',
  primary: '#2AB8B8', // teal fill on band (web-app dark primary)
  brandTeal: '#2AB8B8', // identity teal on a dark ground
  primaryText: '#94E3DE', // teal text/links on band — 4.6:1
  primaryPress: '#1F9A9A',
  onPrimary: '#04201E', // deep teal-black ink on the bright teal
  primarySoft: 'rgba(42,184,184,0.14)',
  primaryEdge: 'rgba(42,184,184,0.32)',
  // Same rule as the teal above: the fill is bright on a dark ground, so the
  // label is dark ink. #9B6BFF + #07202B is 4.75:1; white would be 3.53:1.
  violet: '#9B6BFF', // violet fill on band
  violetText: '#A987FF', // violet text on band — 6.07:1 (raw #9B6BFF is 4.19 on cards)
  violetPress: '#8A5CF0',
  onViolet: '#07202B', // deep band ink on the bright violet
  violetSoft: 'rgba(155,107,255,0.16)',
  violetEdge: 'rgba(155,107,255,0.34)',
  destructive: '#EC7C70', // brightened for AA on dark surfaces
  success: '#B0E5C4', // mint on band — 4.78:1
  warning: '#E0B25C', // amber on band
  info: '#7AA3C2', // slate on band
  energy: '#B0E5C4', // mint on band
  energyFg: '#07202B',
} as const;

/**
 * Active-theme FK colors + an `isDark` flag. Prefer `colors.isDark` over
 * comparing `colors.background` to a literal hex (which silently breaks
 * whenever the palette changes). Memoized so the returned object is a
 * stable identity per theme — it's passed as a prop/dep all over the app.
 */
export function useFKColors() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return useMemo(
    () => ({ ...(isDark ? FK_DARK : FK_LIGHT), isDark }),
    [isDark],
  );
}
