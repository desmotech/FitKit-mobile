import '../global.css';

import { ClerkProvider } from '@clerk/clerk-expo';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { Appearance, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActiveOrgProvider } from '@/providers/active-org-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import { QueryProvider } from '@/providers/query-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import {
  loadActiveOrgId,
  loadAnalyticsConsent,
  loadLocaleOverride,
  loadThemePreference,
  type ThemePreference,
} from '@/lib/settings-store';
import { resolveDeviceLocale, type Locale } from '@/i18n/config';
import { secureTokenCache } from '@/lib/secure-token-cache';
import { apiUrl, clerkPublishableKey, sentryDsn } from '@/lib/api';
import { hydrateAnalyticsConsent } from '@/lib/analytics';
import { useAnalyticsIdentify } from '@/hooks/use-analytics-identify';
import { useScreenTracking } from '@/hooks/use-screen-tracking';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { AnimatedSplash } from '@/components/animated-splash';

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
    // ── FitKit "Whiteboard" type system ──────────────────────────────
    // Static per-weight faces. RN/Android weight-matching within a single
    // family is unreliable, so each weight is registered under its own
    // family name and referenced explicitly (see src/lib/type.ts). The
    // bare aliases (Rubik / Assistant / DMMono) keep NativeWind's
    // `font-display` / `font-sans` / `font-mono` utilities working on
    // screens not yet migrated to the typed `font` map.
    //
    // Bilingual by design: Rubik (display) and Assistant (body) each carry
    // Hebrew + Latin, so mixed-script strings render in one voice. Manrope
    // is kept solely as the Russian/Cyrillic body fallback.
    //
    // Licensing — all SIL Open Font License 1.1 (free for commercial use):
    //   Rubik (He + Latin + Cyrillic) · Assistant (He + Latin) · DM Mono · Manrope

    // Display — Rubik. One geometric face across every script.
    'Rubik-Regular': require('../assets/fonts/Rubik-Regular.ttf'),
    'Rubik-Medium': require('../assets/fonts/Rubik-Medium.ttf'),
    'Rubik-SemiBold': require('../assets/fonts/Rubik-SemiBold.ttf'),
    'Rubik-Bold': require('../assets/fonts/Rubik-Bold.ttf'),
    'Rubik-Black': require('../assets/fonts/Rubik-Black.ttf'),

    // Body / UI — Assistant (Hebrew + Latin). Base alias = Regular.
    'Assistant-Regular': require('../assets/fonts/Assistant-Regular.ttf'),
    'Assistant-Medium': require('../assets/fonts/Assistant-Medium.ttf'),
    'Assistant-SemiBold': require('../assets/fonts/Assistant-SemiBold.ttf'),
    'Assistant-Bold': require('../assets/fonts/Assistant-Bold.ttf'),
    'Assistant-ExtraBold': require('../assets/fonts/Assistant-ExtraBold.ttf'),

    // Russian body fallback — Manrope (Cyrillic; Assistant has none).
    Manrope: require('../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
    'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
    'Manrope-ExtraBold': require('../assets/fonts/Manrope-ExtraBold.ttf'),
  });

  // Preload persisted theme + locale before first paint so the app renders
  // in the right scheme/language immediately (no light→dark or en→he flash).
  // `null` = still loading; we hold the splash until it resolves.
  const [settings, setSettings] = useState<{
    theme: ThemePreference;
    locale: Locale | null;
    activeOrgId: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadThemePreference(),
      loadLocaleOverride(),
      loadAnalyticsConsent(),
      loadActiveOrgId(),
    ]).then(([theme, locale, analyticsConsent, activeOrgId]) => {
      if (!cancelled) {
        hydrateAnalyticsConsent(analyticsConsent);
        setSettings({ theme, locale, activeOrgId });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The animated splash (design port) overlays the app on top of the native
  // splash once fonts + settings are ready, then fades itself out.
  const [splashDone, setSplashDone] = useState(false);

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

  // Match the splash to the persisted theme so there's no light↔dark flash
  // between the native splash and the app's first painted frame.
  const resolvedDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && Appearance.getColorScheme() === 'dark');

  // The splash mounts outside I18nProvider, so resolve the locale the same
  // way the provider does — persisted override, else device locale.
  const splashLocale: Locale =
    settings.locale ?? resolveDeviceLocale(getLocales());

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
                <ActiveOrgProvider initialActiveOrgId={settings.activeOrgId}>
                  <QueryProvider>
                    <RealtimeProvider>
                    <PushBootstrap />
                    <StatusBar style="auto" />
                    <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    {/* Messages lives at the root (not in (tabs)) — native
                        tabs only render declared triggers, so this opens
                        full-screen over the tab shell, like announcements. */}
                    <Stack.Screen name="messages" />
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
                    </RealtimeProvider>
                  </QueryProvider>
                </ActiveOrgProvider>
              </ThemeProvider>
            </I18nProvider>
          </KeyboardProvider>
          {!splashDone && (
            <AnimatedSplash
              dark={resolvedDark}
              locale={splashLocale}
              onDone={() => setSplashDone(true)}
            />
          )}
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
        backgroundColor: '#0B0B0D',
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
  useScreenTracking();
  return null;
}

// `Sentry.wrap` registers a React error boundary + native crash handler
// around the entire tree. The wrap MUST be on the default export per the
// Expo manual-setup guide.
export default Sentry.wrap(RootLayout);
