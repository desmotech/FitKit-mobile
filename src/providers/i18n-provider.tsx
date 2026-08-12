import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Alert, I18nManager, Platform } from 'react-native';
import { useLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { dictionaries, type Dictionary } from '@fitkit/shared';
import { localeConfig, resolveDeviceLocale, type Locale } from '@/i18n/config';
import { reportHandledError } from '@/lib/error-reporting';
import { clearLocaleOverride, saveLocaleOverride } from '@/lib/settings-store';

type I18nValue = {
  lang: Locale;
  dir: 'ltr' | 'rtl';
  t: Dictionary;
  /** Whether the active locale is an explicit in-app choice (vs. the OS). */
  isOverridden: boolean;
  setLang: (next: Locale) => void;
  /** Drop the in-app override and fall back to the device locale. */
  useDeviceLocale: () => void;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Opt out of RN's automatic RTL flipping. We handle layout direction
 * ourselves via explicit `flexDirection: 'row-reverse'` in components
 * (driven by `useI18n().dir`). Letting RN do it AND doing it ourselves
 * stacks the negations and flips LTR layouts when isRTL gets stuck at
 * true after a Hebrew switch.
 *
 * If `I18nManager.isRTL` is true on cold start (e.g. carried over from
 * a previous session), we reset and reload once so subsequent locale
 * switches don't have to.
 */
async function ensureManualRTL() {
  if (Platform.OS === 'web') return;
  // Disable both the system and the runtime-applied RTL.
  I18nManager.allowRTL(false);
  if (I18nManager.isRTL) {
    I18nManager.forceRTL(false);
    try {
      await Updates.reloadAsync();
    } catch (err) {
      // Production consequence is real: layout direction stays wrong until
      // the member restarts by hand, and the alert below is DEV-only, so
      // this was invisible.
      reportHandledError(err, { feature: 'rtl-reset-reload' });
      if (__DEV__) {
        Alert.alert(
          'Reload needed',
          'Layout direction was reset; please reload the app for it to take effect.',
        );
      }
    }
  }
}

/**
 * @param initialOverride The persisted in-app language choice, or `null` to
 *   follow the device locale. Preloaded in `app/_layout.tsx` so the first
 *   frame already renders in the right language (no en→he flash).
 */
export function I18nProvider({
  initialOverride,
  children,
}: {
  initialOverride: Locale | null;
  children: ReactNode;
}) {
  // `useLocales()` re-renders when the OS / per-app language setting changes,
  // so a member can switch language from the device Settings app and the UI
  // follows live — provided they haven't pinned a language in-app.
  const locales = useLocales();
  const [override, setOverride] = useState<Locale | null>(initialOverride);

  const lang = override ?? resolveDeviceLocale(locales);

  // Disable RN's automatic RTL flip so toggling locale doesn't require a
  // reload. Layout direction is handled per-component via `useI18n().dir`.
  useEffect(() => {
    ensureManualRTL().catch(() => undefined);
  }, []);

  const setLang = useCallback((next: Locale) => {
    setOverride(next);
    void saveLocaleOverride(next);
  }, []);

  const useDeviceLocale = useCallback(() => {
    setOverride(null);
    void clearLocaleOverride();
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: localeConfig[lang].dir,
      t: dictionaries[lang],
      isOverridden: override !== null,
      setLang,
      useDeviceLocale,
    }),
    [lang, override, setLang, useDeviceLocale],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useDictionary(): Dictionary {
  return useI18n().t;
}

export function useTranslate<K extends keyof Dictionary>(section: K) {
  const { t } = useI18n();
  return useCallback(() => t[section], [t, section])();
}
