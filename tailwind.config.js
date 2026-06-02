/**
 * FitKit Mobile — Tailwind config.
 * HSL channel-split tokens (shadcn pattern). Each token is referenced
 * via `hsl(var(--token) / <alpha-value>)` so Tailwind's alpha modifier
 * (e.g. `border-border/60`, `bg-primary/12`) works under NativeWind 4.
 *
 * NativeWind 4 still requires Tailwind v3.
 */
const nativewindPreset = require('nativewind/preset');

const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: {
          DEFAULT: c('card'),
          foreground: c('card-foreground'),
        },
        popover: {
          DEFAULT: c('popover'),
          foreground: c('popover-foreground'),
        },
        primary: {
          DEFAULT: c('primary'),
          foreground: c('primary-foreground'),
        },
        secondary: {
          DEFAULT: c('secondary'),
          foreground: c('secondary-foreground'),
        },
        muted: {
          DEFAULT: c('muted'),
          foreground: c('muted-foreground'),
        },
        accent: {
          DEFAULT: c('accent'),
          foreground: c('accent-foreground'),
        },
        energy: {
          DEFAULT: c('energy'),
          foreground: c('energy-foreground'),
        },
        destructive: {
          DEFAULT: c('destructive'),
          foreground: c('destructive-foreground'),
        },
        success: {
          DEFAULT: c('success'),
          foreground: c('success-foreground'),
          muted: c('success-muted'),
        },
        warning: {
          DEFAULT: c('warning'),
          foreground: c('warning-foreground'),
          muted: c('warning-muted'),
        },
        info: {
          DEFAULT: c('info'),
          foreground: c('info-foreground'),
          muted: c('info-muted'),
        },
        sage: c('accent'),
        border: c('border'),
        input: c('input'),
        ring: c('ring'),
        chart: {
          1: c('chart-1'),
          2: c('chart-2'),
          3: c('chart-3'),
          4: c('chart-4'),
          5: c('chart-5'),
        },
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 12px)',
        '4xl': 'calc(var(--radius) + 16px)',
      },
      fontFamily: {
        // Body / UI — Manrope. Weight-specific families for reliable
        // rendering (Android ignores fontWeight on custom single-weight
        // families, so we map weight → family explicitly).
        sans: ['Manrope', 'sans-serif'],
        'sans-medium': ['Manrope-Medium', 'sans-serif'],
        'sans-semibold': ['Manrope-SemiBold', 'sans-serif'],
        'sans-bold': ['Manrope-Bold', 'sans-serif'],
        'sans-extrabold': ['Manrope-ExtraBold', 'sans-serif'],
        // Display — Clash Grotesk (base alias = Bold).
        display: ['ClashGrotesk', 'sans-serif'],
        'display-medium': ['ClashGrotesk-Medium', 'sans-serif'],
        'display-semibold': ['ClashGrotesk-Semibold', 'sans-serif'],
        'display-bold': ['ClashGrotesk-Bold', 'sans-serif'],
        // Numerals / labels — DM Mono.
        mono: ['DMMono', 'monospace'],
        'mono-medium': ['DMMono-Medium', 'monospace'],
        // Hebrew — Alef body + Rubik display (replaces Heebo).
        heebo: ['Alef', 'sans-serif'],
        hebrew: ['Alef', 'sans-serif'],
        'hebrew-bold': ['Alef-Bold', 'sans-serif'],
        'hebrew-display': ['Rubik-Bold', 'sans-serif'],
        'hebrew-display-black': ['Rubik-Black', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.05em',
        tighter: '-0.03em',
        tight: '-0.02em',
      },
    },
  },
  plugins: [],
};
