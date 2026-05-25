import '../global.css';

import { ClerkProvider } from '@clerk/clerk-expo';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '@/providers/i18n-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { secureTokenCache } from '@/lib/secure-token-cache';
import { clerkPublishableKey, sentryDsn } from '@/lib/api';
import { useAnalyticsIdentify } from '@/hooks/use-analytics-identify';
import { usePushNotifications } from '@/hooks/use-push-notifications';

// Sentry — initialized once at module load, per the Expo manual-setup
// guide (docs.sentry.io/platforms/react-native/manual-setup/expo/). The
// SDK is a no-op when `dsn` is empty, so dev builds without the env var
// stay silent. Source maps + debug IDs are uploaded automatically during
// EAS Build via the `@sentry/react-native/expo` config plugin (see
// app.config.ts) and the `getSentryExpoConfig` wrapper in metro.config.js.
Sentry.init({
  dsn: sentryDsn,
  // Privacy posture: keep PII off by default; align with our shipping
  // PrivacyInfo.xcprivacy manifest (NSPrivacyTracking=false).
  sendDefaultPii: false,
  // Performance traces stay off until we have a specific bottleneck to
  // profile — they balloon event volume otherwise.
  tracesSampleRate: 0,
  // Session Replay: capture 100% of error sessions + 10% of normal
  // sessions so we can see what the alpha tester was doing when it broke.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [Sentry.mobileReplayIntegration()],
});

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // FitKit display + body fonts. Bundle .otf/.ttf files in assets/fonts/.
    // See assets/fonts/README.md for sourcing instructions.
    // ClashGrotesk: require('../assets/fonts/ClashGrotesk-Variable.ttf'),
    // Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
    // Heebo: require('../assets/fonts/Heebo-Variable.ttf'),
    // DMMono: require('../assets/fonts/DMMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!clerkPublishableKey) {
    // Surface misconfiguration loudly during dev; production builds set
    // EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY via EAS.
    throw new Error(
      'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in .env.',
    );
  }

  return (
    <ClerkProvider
      tokenCache={secureTokenCache}
      publishableKey={clerkPublishableKey}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <I18nProvider>
              <ThemeProvider>
                <QueryProvider>
                  <PushBootstrap />
                  <StatusBar style="auto" />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="checkin" />
                    <Stack.Screen name="log" />
                    <Stack.Screen
                      name="announcements"
                      options={{ presentation: 'pageSheet' }}
                    />
                    <Stack.Screen
                      name="+not-found"
                      options={{ headerShown: true, title: 'Not found' }}
                    />
                  </Stack>
                </QueryProvider>
              </ThemeProvider>
            </I18nProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

/**
 * Wraps the push-notifications hook in a child component so it runs inside
 * the ClerkProvider tree (useAuth) and the QueryProvider (just to be safe
 * for future cache-invalidation calls). No UI, purely side-effects.
 */
function PushBootstrap() {
  usePushNotifications();
  useAnalyticsIdentify();
  return null;
}

// `Sentry.wrap` registers a React error boundary + native crash handler
// around the entire tree. The wrap MUST be on the default export per the
// Expo manual-setup guide.
export default Sentry.wrap(RootLayout);
