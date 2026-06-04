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
        // Body / UI — Assistant (Hebrew + Latin), full weight ramp.
        // (Russian/Cyrillic body is routed to Manrope via bodyFamily() in
        // src/lib/type.ts; Assistant has no Cyrillic.)
        sans: ['Assistant-Regular', 'sans-serif'],
        'sans-medium': ['Assistant-Medium', 'sans-serif'],
        'sans-semibold': ['Assistant-SemiBold', 'sans-serif'],
        'sans-bold': ['Assistant-Bold', 'sans-serif'],
        'sans-extrabold': ['Assistant-ExtraBold', 'sans-serif'],
        // Display — Rubik (Hebrew + Latin + Cyrillic; base alias = Bold).
        display: ['Rubik-Bold', 'sans-serif'],
        'display-medium': ['Rubik-Medium', 'sans-serif'],
        'display-semibold': ['Rubik-SemiBold', 'sans-serif'],
        'display-bold': ['Rubik-Bold', 'sans-serif'],
        // Numerals / labels — Assistant (DM Mono removed; numbers use
        // tabular-nums where alignment matters).
        mono: ['Assistant-Medium', 'sans-serif'],
        'mono-medium': ['Assistant-SemiBold', 'sans-serif'],
        // Hebrew aliases — now the same universal Rubik/Assistant faces.
        heebo: ['Assistant-Regular', 'sans-serif'],
        hebrew: ['Assistant-Regular', 'sans-serif'],
        'hebrew-bold': ['Assistant-Bold', 'sans-serif'],
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
