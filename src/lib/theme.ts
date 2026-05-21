/**
 * FitKit raw color tokens. Mirrors the design bundle's FKColors object.
 *
 * Use these only for native props (StatusBar tintColor, RefreshControl
 * tintColor, splash backgrounds) where NativeWind className isn't an
 * option. For everything in JSX, prefer Tailwind classes.
 */
export const colors = {
  light: {
    background: '#F6F8FA',
    foreground: '#0D1B2A',
    card: '#FFFFFF',
    muted: '#EEF2F6',
    border: '#DDE3EA',
    mutedForeground: '#5E7082',
    primary: '#0E8C8C',
    primaryDeep: '#0E6B6B',
    primaryForeground: '#FFFFFF',
    sage: '#7A8A5C',
    amber: '#C9974D',
    rust: '#B84A40',
    slate: '#4A7290',
    mauve: '#8A6584',
  },
  dark: {
    background: '#0A1628',
    foreground: '#E8F0F8',
    card: '#112240',
    muted: '#1A3050',
    border: '#1E3A5F',
    mutedForeground: '#6B8FAA',
    primary: '#2AB8B8',
    primaryDeep: '#0A1E3D',
    primaryForeground: '#FFFFFF',
    sage: '#8AA86A',
    amber: '#C9974D',
    rust: '#D05A50',
    slate: '#6A9AB8',
    mauve: '#A67EA0',
  },
} as const;

export const heroGradient = {
  light: ['#0E6B6B', '#0E8C8C'] as const,
  dark: ['#0A1E3D', '#0D3060'] as const,
};

export type ColorScheme = keyof typeof colors;
export type Palette = (typeof colors)[ColorScheme];
