import '../global.css';

import { ClerkProvider } from '@clerk/clerk-expo';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '@/providers/i18n-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import {
  loadLocaleOverride,
  loadThemePreference,
  type ThemePreference,
} from '@/lib/settings-store';
import type { Locale } from '@/i18n/config';
import { secureTokenCache } from '@/lib/secure-token-cache';
import { apiUrl, clerkPublishableKey, sentryDsn } from '@/lib/api';
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
  // Performance tracing: sample 30% in release, 100% in dev. Mirrors the
  // web + API rates so a mobile-initiated trace chains through to the API.
  tracesSampleRate: __DEV__ ? 1.0 : 0.3,
  // Attach sentry-trace/baggage to API requests so spans link mobile → API.
  // RN has no same-origin default, so this must be set explicitly. `apiUrl`
  // adapts per build (localhost / preview / api.fitkit.fit).
  tracePropagationTargets: [apiUrl],
  // Session Replay: capture 100% of error sessions + 10% of normal
  // sessions so we can see what the alpha tester was doing when it broke.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.reactNativeTracingIntegration(),
  ],
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

  // Preload persisted theme + locale before first paint so the app renders
  // in the right scheme/language immediately (no light→dark or en→he flash).
  // `null` = still loading; we hold the splash until it resolves.
  const [settings, setSettings] = useState<{
    theme: ThemePreference;
    locale: Locale | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadThemePreference(), loadLocaleOverride()]).then(
      ([theme, locale]) => {
        if (!cancelled) setSettings({ theme, locale });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = (fontsLoaded || fontError) && settings != null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready || !settings) {
    return null;
  }

  if (!clerkPublishableKey) {
    // A missing key is a build-time misconfiguration (env var not baked
    // into the bundle). Previously we `throw`, but an unhandled throw at
    // the root renders as an indefinite blank splash — which is exactly
    // what got build 1.0.0(2) rejected by App Review (Guideline 2.1a:
    // "loads for an indefinite amount of time"). Render a visible, static
    // error screen instead so the failure is diagnosable, never a hang.
    return <ConfigErrorScreen />;
  }

  return (
    <ClerkProvider
      tokenCache={secureTokenCache}
      publishableKey={clerkPublishableKey}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <I18nProvider initialOverride={settings.locale}>
              <ThemeProvider initialPreference={settings.theme}>
                <QueryProvider>
                  <PushBootstrap />
                  <StatusBar style="auto" />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="checkin" />
                    <Stack.Screen name="log" />
                    <Stack.Screen name="onboarding" />
                    {/* /forms/sign/[token] — public, token-gated.
                        See app/forms/_layout.tsx for the no-gate
                        rationale. Reachable via Universal Link or
                        custom-scheme deep link for local testing. */}
                    <Stack.Screen name="forms" />
                    {/* /sign-up is the Clerk invite-ticket landing route.
                        Lives OUTSIDE (auth) on purpose — the (auth) group
                        is GuestOnly, which would redirect a stale-session
                        user away from the invite screen before it ever
                        gets to process the ticket. */}
                    <Stack.Screen name="sign-up" />
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
 * Static, dependency-free fallback shown when the app is built without a
 * Clerk publishable key. Deliberately uses only core RN primitives (no
 * providers, no theme, no fonts) so it renders even when the rest of the
 * tree can't initialize. Hides the splash on mount so the user never sees
 * an indefinite load.
 */
function ConfigErrorScreen() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: '#0A1628',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Configuration error
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        This build is missing required configuration and can’t start. Please
        reinstall the latest version from the App Store, or contact support if
        the problem persists.
      </Text>
    </View>
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
