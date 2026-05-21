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
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
import { dictionaries, type Dictionary } from '@fitkit/shared';
import { i18n, isLocale, localeConfig, type Locale } from '@/i18n/config';

type I18nValue = {
  lang: Locale;
  dir: 'ltr' | 'rtl';
  t: Dictionary;
  setLang: (next: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

function detectInitialLocale(): Locale {
  const device = Localization.getLocales()[0]?.languageCode;
  if (isLocale(device)) return device;
  return i18n.defaultLocale;
}

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
    } catch {
      if (__DEV__) {
        Alert.alert(
          'Reload needed',
          'Layout direction was reset; please reload the app for it to take effect.',
        );
      }
    }
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(detectInitialLocale);

  // Disable RN's automatic RTL flip so toggling locale doesn't require a
  // reload. Layout direction is handled per-component via `useI18n().dir`.
  useEffect(() => {
    ensureManualRTL().catch(() => undefined);
  }, []);

  const setLang = useCallback((next: Locale) => {
    setLangState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: localeConfig[lang].dir,
      t: dictionaries[lang],
      setLang,
    }),
    [lang, setLang],
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
