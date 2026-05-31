import { useColorScheme } from 'nativewind';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  saveThemePreference,
  type ThemePreference,
} from '@/lib/settings-store';

/**
 * Theme provider — bridges the user's persisted theme choice to NativeWind
 * so the `dark:` Tailwind variants resolve correctly.
 *
 * Three preferences:
 *   - `'system'` — follow the OS appearance (default; honours
 *     `userInterfaceStyle: 'automatic'` in app.config). NativeWind tracks
 *     the device scheme live, so a Settings change flips the app in place.
 *   - `'light'` / `'dark'` — an explicit override.
 *
 * The preference is persisted to AsyncStorage and re-applied on the next
 * cold start (the initial value is preloaded in `app/_layout.tsx` so there's
 * no first-frame flash). Previously this provider hard-forced the device
 * scheme on every launch *and* every OS appearance change, which silently
 * threw away whatever the user picked in Profile → Theme — that's the
 * "theme not persisted" bug.
 */
type ThemeValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: ReactNode;
}) {
  const { setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);

  // Apply to NativeWind. Passing `'system'` makes NativeWind follow the OS
  // appearance and react to live changes on its own — no manual listener.
  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void saveThemePreference(next);
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx)
    throw new Error('useThemePreference must be used within ThemeProvider');
  return ctx;
}
