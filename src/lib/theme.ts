/**
 * FitKit raw color tokens — "Whiteboard" palette. Mirrors global.css.
 *
 * Use these only for native props (StatusBar tintColor, RefreshControl
 * tintColor, splash backgrounds) and inline RN styles where NativeWind
 * className isn't an option. For everything in JSX, prefer Tailwind classes.
 *
 * Dark = matte ink (the lead identity). Light = warm paper. Teal is the
 * cool/brand accent; `energy` (volt) is the high-signal athletic accent.
 */
export const colors = {
  light: {
    background: '#F6F4EE', // warm paper
    foreground: '#161512', // ink
    card: '#FCFBF7',
    muted: '#EEEBE2',
    border: '#E3DFD4',
    mutedForeground: '#6E695E',
    primary: '#0E8C8C',
    primaryDeep: '#0B6E6E',
    primaryForeground: '#FFFFFF',
    energy: '#D7FF3E', // volt
    energyForeground: '#17160F',
    sage: '#7A8A5C',
    amber: '#C9974D',
    rust: '#B84A40',
    slate: '#4A7290',
    mauve: '#8A6584',
  },
  dark: {
    background: '#0B0B0D', // matte ink
    foreground: '#F3F0E9', // warm chalk
    card: '#141417',
    muted: '#1B1B1F',
    border: '#26262B',
    mutedForeground: '#9A958A',
    primary: '#27C8BA',
    primaryDeep: '#0E6B6B',
    primaryForeground: '#FFFFFF',
    energy: '#D7FF3E', // volt
    energyForeground: '#0E0E0A',
    sage: '#8AA86A',
    amber: '#C9974D',
    rust: '#E0685C',
    slate: '#6A9AB8',
    mauve: '#A67EA0',
  },
} as const;

export const heroGradient = {
  light: ['#0B6E6E', '#0E8C8C'] as const,
  dark: ['#0E3B38', '#0B0B0D'] as const,
};

export type ColorScheme = keyof typeof colors;
export type Palette = (typeof colors)[ColorScheme];
