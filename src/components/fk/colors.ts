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
  card: '#FCFBF7',
  foreground: '#161512',
  background: '#F6F4EE',
  muted: '#EEEBE2',
  mutedFg: '#605B51', // WCAG AA on bg + glass (≥4.5:1)
  secondary: '#EEEBE2',
  secondaryFg: '#0E8C8C',
  border: '#E3DFD4',
  primary: '#0E8C8C', // brand teal — fills/graphics
  primaryText: '#0A6E6E', // darker teal for small text (AA on light surfaces)
  onPrimary: '#FFFFFF', // ink on a primary-filled surface
  // The tinted-primary tile: icon plates, empty-state tiles, badge fills.
  // Hand-rolled `rgba(14,140,140,…)` literals of these two were scattered
  // across a dozen files and none of them adapted to dark mode.
  primarySoft: 'rgba(14,140,140,0.10)',
  primaryEdge: 'rgba(14,140,140,0.28)',
  destructive: '#B84A40', // the ONE destructive red (was 3 drifting values)
  energy: '#D7FF3E',
  energyFg: '#17160F',
} as const;

export const FK_DARK = {
  card: '#141417',
  foreground: '#F3F0E9',
  background: '#0B0B0D',
  muted: '#1B1B1F',
  mutedFg: '#C8C3B8', // bright secondary ink — legible on the dark gradient
  secondary: '#1B1B1F',
  secondaryFg: '#F3F0E9',
  border: '#26262B',
  primary: '#27C8BA',
  primaryText: '#27C8BA', // already AA on dark surfaces
  onPrimary: '#04201E', // deep teal-black ink on the bright dark-mode teal
  primarySoft: 'rgba(39,200,186,0.12)',
  primaryEdge: 'rgba(39,200,186,0.30)',
  destructive: '#EC7C70', // brightened for AA on dark surfaces
  energy: '#D7FF3E',
  energyFg: '#0E0E0A',
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
