/**
 * Taikan "Whiteboard" type system.
 *
 * Concrete, per-weight font-family names registered in app/_layout.tsx.
 * Reference these directly in inline `style={{ fontFamily }}` — they render
 * the exact weight on both iOS and Android (unlike `fontWeight`, which
 * Android ignores for custom single-weight families).
 *
 * Two bilingual voices + numerals:
 *   • display — Rubik. Hebrew + Latin + Cyrillic in one geometric face, so
 *               mixed-script headlines ("Pull Up · 20 דקות") read as one voice.
 *   • body    — Assistant. Calm, legible Hebrew + Latin. Everything paragraph.
 *   • mono    — DM Mono. The "scoreboard": pure numerals only (no Hebrew).
 *
 * Language resolution (see `displayFamily`/`bodyFamily`): display is fully
 * universal (Rubik covers every script). Body is Assistant for he + en, and
 * Manrope for ru only — Assistant has no Cyrillic.
 */

export const font = {
  // Display — Rubik (Hebrew + Latin + Cyrillic). One face, every script.
  display: 'Rubik-Bold', // base alias = Bold
  displayBlack: 'Rubik-Black',
  displayBold: 'Rubik-Bold',
  displaySemibold: 'Rubik-SemiBold',
  displayMedium: 'Rubik-Medium',
  displayRegular: 'Rubik-Regular',

  // Body / UI — Assistant (Hebrew + Latin).
  body: 'Assistant-Regular',
  bodyMedium: 'Assistant-Medium',
  bodySemibold: 'Assistant-SemiBold',
  bodyBold: 'Assistant-Bold',
  bodyExtrabold: 'Assistant-ExtraBold',

  // Numerals — DM Mono (the "scoreboard"). Latin/digits only.
  mono: 'Assistant-Medium',
  monoMedium: 'Assistant-SemiBold',

  // Russian body — Manrope (Cyrillic). Routed only for ru via bodyFamily().
  ruBody: 'Manrope',
  ruBodyMedium: 'Manrope-Medium',
  ruBodySemibold: 'Manrope-SemiBold',
  ruBodyBold: 'Manrope-Bold',
  ruBodyExtrabold: 'Manrope-ExtraBold',

  // Back-compat aliases — Hebrew now shares the universal Rubik/Assistant
  // faces, so the old Hebrew-only split collapses onto them.
  hebrewDisplay: 'Rubik-Bold',
  hebrewDisplayBlack: 'Rubik-Black',
  hebrewDisplayMedium: 'Rubik-Medium',
  hebrewBody: 'Assistant-Regular',
  hebrewBodyBold: 'Assistant-Bold',
  alef: 'Assistant-Regular',
  alefBold: 'Assistant-Bold',
} as const;

type Lang = string | undefined;
const isHe = (lang: Lang) => lang === 'he';

/**
 * Display family. Rubik covers Hebrew + Latin + Cyrillic, so the face is
 * language-independent — `_lang` is kept only for call-site symmetry.
 */
export function displayFamily(
  _lang: Lang,
  tier: 'black' | 'bold' | 'semibold' | 'medium' = 'bold',
): string {
  switch (tier) {
    case 'black':
      return font.displayBlack;
    case 'semibold':
      return font.displaySemibold;
    case 'medium':
      return font.displayMedium;
    default:
      return font.displayBold;
  }
}

/** Body family for the active language. Assistant for he + en; Manrope for ru. */
export function bodyFamily(
  lang: Lang,
  weight: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' = 'regular',
): string {
  if (lang === 'ru') {
    switch (weight) {
      case 'medium':
        return font.ruBodyMedium;
      case 'semibold':
        return font.ruBodySemibold;
      case 'bold':
        return font.ruBodyBold;
      case 'extrabold':
        return font.ruBodyExtrabold;
      default:
        return font.ruBody;
    }
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
 * Eyebrow / kicker label style, resolved per language.
 *
 * Latin gets the DM Mono "scoreboard" look: uppercase, tracked-out. Hebrew
 * can take NEITHER — DM Mono has no Hebrew glyphs (so it silently falls back
 * to the system font) and Hebrew script must never be letter-spaced (it
 * shatters the words). So Hebrew eyebrows render in Assistant SemiBold, flush
 * and untracked.
 *
 * Spread onto the label's Text style:
 *   style={[{ fontSize: 11, fontWeight: '700', color }, eyebrow(lang)]}
 */
export function eyebrow(lang: Lang): {
  fontFamily: string;
  letterSpacing: number;
  textTransform: 'uppercase' | 'none';
} {
  if (isHe(lang)) {
    return {
      fontFamily: font.bodySemibold,
      letterSpacing: 0,
      textTransform: 'none',
    };
  }
  return { fontFamily: font.mono, letterSpacing: 1.4, textTransform: 'uppercase' };
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
