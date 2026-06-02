/**
 * FitKit "Whiteboard" type system.
 *
 * Concrete, per-weight font-family names registered in app/_layout.tsx.
 * Reference these directly in inline `style={{ fontFamily }}` — they render
 * the exact weight on both iOS and Android (unlike `fontWeight`, which
 * Android ignores for custom single-weight families).
 *
 * Three voices:
 *   • display — Clash Grotesk. Big, tight, confident. Headlines + hero.
 *   • body    — Manrope. Calm, legible. Everything paragraph/label.
 *   • mono    — DM Mono. The "scoreboard": every number, kicker, and code.
 *
 * Hebrew swaps display→Rubik and body→Alef (see `displayFamily`/`bodyFamily`).
 */

export const font = {
  // Display — Clash Grotesk
  display: 'ClashGrotesk', // = Bold
  displayBold: 'ClashGrotesk-Bold',
  displaySemibold: 'ClashGrotesk-Semibold',
  displayMedium: 'ClashGrotesk-Medium',
  displayRegular: 'ClashGrotesk-Regular',

  // Body / UI — Manrope
  body: 'Manrope',
  bodyMedium: 'Manrope-Medium',
  bodySemibold: 'Manrope-SemiBold',
  bodyBold: 'Manrope-Bold',
  bodyExtrabold: 'Manrope-ExtraBold',

  // Numerals / labels — DM Mono
  mono: 'DMMono',
  monoMedium: 'DMMono-Medium',

  // Hebrew — Alef (body) + Rubik (display)
  hebrewBody: 'Alef',
  hebrewBodyBold: 'Alef-Bold',
  hebrewDisplay: 'Rubik-Bold',
  hebrewDisplayBlack: 'Rubik-Black',
  hebrewDisplayMedium: 'Rubik-Medium',
} as const;

type Lang = string | undefined;
const isHe = (lang: Lang) => lang === 'he';

/** Display family for the active language. Pass the heaviest tier you need. */
export function displayFamily(
  lang: Lang,
  tier: 'black' | 'bold' | 'semibold' | 'medium' = 'bold',
): string {
  if (isHe(lang)) {
    if (tier === 'black') return font.hebrewDisplayBlack;
    if (tier === 'medium') return font.hebrewDisplayMedium;
    return font.hebrewDisplay; // bold / semibold → Rubik Bold
  }
  if (tier === 'black' || tier === 'bold') return font.displayBold;
  if (tier === 'semibold') return font.displaySemibold;
  return font.displayMedium;
}

/** Body family for the active language. */
export function bodyFamily(
  lang: Lang,
  weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' = 'regular',
): string {
  if (isHe(lang)) {
    return weight === 'regular' || weight === 'medium'
      ? font.hebrewBody
      : font.hebrewBodyBold;
  }
  switch (weight) {
    case 'medium':
      return font.bodyMedium;
    case 'semibold':
      return font.bodySemibold;
    case 'bold':
      return font.bodyBold;
    case 'extrabold':
      return font.bodyExtrabold;
    default:
      return font.body;
  }
}

/**
 * Type ramp — paired size/leading/tracking presets in the Whiteboard voice.
 * Spread into a Text style: `style={[type.hero, { color }]}`. Family is set
 * per-call via displayFamily()/bodyFamily()/font.mono so language + platform
 * resolve correctly.
 */
export const type = {
  /** Poster headline — workout name, big balance figures. */
  hero: { fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
  /** Screen / large-title. */
  title: { fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  /** Section heading. */
  heading: { fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  /** Card / row title. */
  subhead: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  /** Body copy. */
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  /** Secondary / caption. */
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** Mono kicker / uppercase label — pair with font.mono + letterSpacing. */
  kicker: { fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
} as const;
