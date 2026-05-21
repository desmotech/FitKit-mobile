import { useColorScheme } from 'nativewind';
import { useEffect, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

/**
 * Theme provider — bridges the device color scheme to NativeWind so the
 * `dark:` Tailwind variants work without manual setup. Profile → Theme
 * will later flip `colorScheme` directly via NativeWind's setter.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemScheme();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(
      systemScheme === 'light' || systemScheme === 'dark'
        ? systemScheme
        : 'light',
    );
  }, [systemScheme, setColorScheme]);

  return <>{children}</>;
}
