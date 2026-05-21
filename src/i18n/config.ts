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
