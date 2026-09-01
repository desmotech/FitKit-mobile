/**
 * Mirrors apps/web/src/i18n/config.ts. Mobile defaults to Hebrew per the
 * web app's behavior; locale is overridden by device locale on first
 * launch and persisted thereafter.
 */
export const i18n = {
  defaultLocale: 'he',
  locales: ['he', 'en', 'ru'],
} as const;

export type Locale = (typeof i18n)['locales'][number];

export const localeConfig: Record<
  Locale,
  { dir: 'ltr' | 'rtl'; label: string }
> = {
  he: { dir: 'rtl', label: 'עברית' },
  en: { dir: 'ltr', label: 'English' },
  ru: { dir: 'ltr', label: 'Русский' },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (i18n.locales as readonly string[]).includes(value);
}

/**
 * The direction the OPERATING SYSTEM renders this app in — which is what
 * decides whether the platform has already mirrored its native views for us.
 *
 * Both iOS and Android mirror a native tab bar when they render an app in an
 * RTL language, and they can only do that for a language the app actually
 * ships (`supportedLocales` in app.config.ts → CFBundleLocalizations /
 * locales_config.xml). So the question is not "is the device Hebrew" but
 * "did the OS pick a language we ship, and is that language RTL" — the same
 * ordered walk {@link resolveDeviceLocale} does.
 *
 * Deliberately NOT `localeConfig[resolveDeviceLocale(locales)].dir`: that
 * helper falls back to the app default (`he`, RTL) when nothing matches, and
 * "nothing matched" is exactly the case where the OS fell back to the
 * bundle's development region and did NOT mirror. A French phone would be
 * read as RTL and the tab bar would come out backwards.
 */
export function resolveDeviceDir(
  locales: readonly { languageCode: string | null }[] | undefined,
): 'ltr' | 'rtl' {
  for (const l of locales ?? []) {
    if (isLocale(l.languageCode)) return localeConfig[l.languageCode].dir;
  }
  return 'ltr';
}

/**
 * Pick the first shipped locale from an ordered device-locale list
 * (expo-localization `getLocales()` / `useLocales()`), else the app default.
 */
export function resolveDeviceLocale(
  locales: readonly { languageCode: string | null }[] | undefined,
): Locale {
  for (const l of locales ?? []) {
    if (isLocale(l.languageCode)) return l.languageCode;
  }
  return i18n.defaultLocale;
}
