import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FitKit',
  slug: 'fitkit',
  scheme: 'fitkit',
  version: '1.0.3',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  // Splash config lives solely in the expo-splash-screen plugin below —
  // the plugin is authoritative on SDK 52+, and a second top-level `splash`
  // block was one more place for the colors to drift out of sync.
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'fit.fitkit.app',
    supportsTablet: false,
    associatedDomains: ['applinks:app.fitkit.fit'],
    infoPlist: {
      NSCameraUsageDescription:
        'FitKit uses the camera to scan check-in QR codes and to take progress photos and form-check videos.',
      NSPhotoLibraryUsageDescription:
        'FitKit needs photo library access to attach progress photos and form-check videos to your workouts.',
      NSLocationWhenInUseUsageDescription:
        'FitKit uses your location to verify you are at the gym for class check-in.',
      ITSAppUsesNonExemptEncryption: false,
    },
    // Apple privacy manifest — declares the data the app collects so the
    // on-device App Privacy Report and the App Store nutrition label are
    // accurate. Neither posthog-react-native nor @sentry/react-native ships
    // its own PrivacyInfo.xcprivacy, so their collection MUST be declared
    // here. Expo merges this with the required-reason API types from the base
    // template (see @expo/config-plugins mergePrivacyInfo). NSPrivacyTracking
    // stays false — all collection is first-party (no IDFA / cross-app
    // tracking), so no ATT prompt. Keep in sync with the App Store Connect
    // "App Privacy" answers and the Play Console Data safety form.
    privacyManifests: {
      NSPrivacyTracking: false,
      // Required-reason APIs used by React Native core + AsyncStorage. These
      // were previously injected into the generated file, but declaring the
      // collected-data types above makes withPrivacyInfo own the whole
      // manifest — so they must be listed here or they'd drop out. Expo
      // merges these additively (dedupes reasons).
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
      ],
      NSPrivacyCollectedDataTypes: [
        // Identity — Clerk auth + PostHog identify(user.id, { email, name }).
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        // Product analytics — PostHog $screen + member_* events.
        {
          NSPrivacyCollectedDataType:
            'NSPrivacyCollectedDataTypeProductInteraction',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        // Diagnostics — Sentry. Linked to identity: useAnalyticsIdentify calls
        // Sentry.setUser({ id, email }) + tags the PostHog session id, so
        // crash/perf reports carry the user (full web parity). sendDefaultPii
        // stays false (no incidental IP/PII beyond the explicit user object).
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        // First-party feature data sent to the FitKit API.
        {
          // GPS gym check-in (ACCESS_FINE_LOCATION).
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePreciseLocation',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Progress photos / form-check videos.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Workouts, PRs, logged sets.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeFitness',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Body metrics (weight, measurements).
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeHealth',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
      ],
    },
  },
  android: {
    package: 'fit.fitkit.app',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0E8C8C',
    },
    permissions: [
      'CAMERA',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'app.fitkit.fit', pathPrefix: '/checkin' },
          {
            scheme: 'https',
            host: 'app.fitkit.fit',
            pathPrefix: '/he/checkin',
          },
          {
            scheme: 'https',
            host: 'app.fitkit.fit',
            pathPrefix: '/en/checkin',
          },
          {
            scheme: 'https',
            host: 'app.fitkit.fit',
            pathPrefix: '/ru/checkin',
          },
          // Clerk invite ticket redirect target. Clerk's invitation
          // emails point at clerk.fitkit.fit/v1/tickets/accept; after
          // server-side validation Clerk redirects to
          // https://app.fitkit.fit/sign-up?__clerk_ticket=...&__clerk_status=sign_up
          // (per the JWT's rurl). This filter catches that redirect on
          // Android so the app handles invite acceptance instead of
          // the browser falling through to a web fallback. Requires
          // assetlinks.json on /.well-known/ — see FIT-188.
          {
            scheme: 'https',
            host: 'app.fitkit.fit',
            pathPrefix: '/sign-up',
          },
          // FIT-178 token-gated form signing. Email/SMS links from
          // staff bulk-issuing compliance forms land here. Same
          // assetlinks.json + AASA file from FIT-188 cover this path.
          {
            scheme: 'https',
            host: 'app.fitkit.fit',
            pathPrefix: '/forms/sign',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    './plugins/withDisableScriptSandbox',
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      // `supportedLocales` writes CFBundleLocalizations (iOS) and a
      // locales_config.xml + android:localeConfig (Android 13+). Without
      // it, neither OS shows FitKit in its per-app Language setting, so a
      // member can't pick the app's language from device Settings — they
      // could only ever inherit the system language. Keep this list in
      // sync with `i18n.locales` in src/i18n/config.ts.
      'expo-localization',
      { supportedLocales: ['en', 'he', 'ru'] },
    ],
    'expo-updates',
    'expo-image',
    '@react-native-community/datetimepicker',
    [
      'expo-camera',
      {
        cameraPermission:
          'FitKit needs camera access to scan check-in QR codes.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'FitKit uses your location to verify check-in at the gym.',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#0E8C8C',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-splash-screen',
      {
        // Cold-start splash: the brand globe centred on the FitKit splash
        // background. Handled off to the animated <AnimatedSplash> overlay
        // (src/components/animated-splash.tsx) — keep bg + imageWidth in
        // sync with it so the native → animated transition is seamless.
        backgroundColor: '#F6F4EE',
        dark: { backgroundColor: '#050608' },
        image: './assets/images/splash.png',
        imageWidth: 160,
      },
    ],
    [
      'expo-video',
      {
        // Exercise demos play in a fullscreen sheet and auto-pause when it
        // unmounts. Neither background playback nor PiP is needed — and both
        // force `audio` into UIBackgroundModes, which App Review rejects
        // (2.5.4) since the app has no persistent-audio feature.
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: false,
      },
    ],
    [
      // Sentry config-plugin: ships native init + auto source-map upload
      // during native build (needs SENTRY_AUTH_TOKEN as a secret env on
      // EAS). Org + project slugs are public; the token is not.
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        organization: process.env.SENTRY_ORG ?? 'fitkit1',
        project: process.env.SENTRY_PROJECT ?? 'fitkit-mobile',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:3001',
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
    posthogHost:
      process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    // Local/preview feature-flag seed ("flag-a:true,flag-b:false"). Empty
    // in prod, where PostHog is the source of truth.
    featureFlags: process.env.EXPO_PUBLIC_FEATURE_FLAGS ?? '',
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ?? '1f6bb22c-0649-417b-af9e-9154dd4efda0',
    },
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url:
      process.env.EAS_UPDATES_URL ??
      'https://u.expo.dev/1f6bb22c-0649-417b-af9e-9154dd4efda0',
  },
});
