import { execSync } from 'node:child_process';
import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * The commit this JS bundle was built from.
 *
 * `Updates.updateId` identifies an update but says nothing about what is in
 * it — it is a UUID the EAS servers mint at publish time, unrelated to this
 * repo. Stamping the SHA into `extra` is what makes a running bundle
 * self-identifying: `eas update` evaluates this config at publish time and
 * embeds `extra` in the manifest, so a device on an OTA reports the commit
 * that produced it, not the commit its binary was built from.
 *
 * EAS builds get the SHA from the environment; a local build or a local
 * `eas update` reads git directly. Unknown is a fine answer for neither —
 * it must never fail a build.
 */
function resolveCommit(): string {
  const fromEas = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (fromEas) return fromEas.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Taikan',
  slug: 'taikan',
  owner: 'saarku',
  // `taikan` is the brand scheme. `fitkit` stays registered because QR codes
  // printed at gyms before the rebrand encode `fitkit://...` deep links.
  scheme: ['taikan', 'fitkit'],
  // The one place the marketing version lives. iOS `buildNumber` and Android
  // `versionCode` are NOT set here on purpose — eas.json runs
  // `appVersionSource: "remote"` with `autoIncrement` on the production
  // profile, so EAS owns them and setting them locally would fight it.
  //
  // Bumping this also moves `runtimeVersion` (see the policy at the bottom of
  // this file), which is what decides who may receive an OTA update. Read the
  // note there before shipping a release that touches native code.
  version: '1.0.5',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  // Android `colorPrimary`: the recents (task-switcher) header and native
  // dialog accents. Unset, prebuild writes Expo's default navy #023c69.
  primaryColor: '#0E8C8C',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  // Splash config lives solely in the expo-splash-screen plugin below —
  // the plugin is authoritative on SDK 52+, and a second top-level `splash`
  // block was one more place for the colors to drift out of sync.
  assetBundlePatterns: ['**/*'],
  ios: {
    // iOS 18 appearance variants. `light` is the full tile; `dark` is the
    // mark on transparent (the OS supplies the dark plate); `tinted` is a
    // grayscale alpha mask the OS colours. All generated — see assets README.
    icon: {
      light: './assets/images/icon.png',
      dark: './assets/images/icon-dark.png',
      tinted: './assets/images/icon-tinted.png',
    },
    bundleIdentifier: 'fit.taikan.app',
    supportsTablet: false,
    associatedDomains: ['applinks:app.taikan.fit'],
    infoPlist: {
      NSCameraUsageDescription:
        'Taikan uses the camera to scan check-in QR codes and to take progress photos and form-check videos.',
      NSPhotoLibraryUsageDescription:
        'Taikan needs photo library access to attach progress photos and form-check videos to your workouts.',
      NSLocationWhenInUseUsageDescription:
        'Taikan uses your location to verify you are at the gym for class check-in.',
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
        // First-party feature data sent to the Taikan API.
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
    package: 'fit.taikan.app',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0E8C8C',
      // Android 13 themed icons: an alpha silhouette the launcher tints.
      monochromeImage: './assets/images/adaptive-icon-mono.png',
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
          { scheme: 'https', host: 'app.taikan.fit', pathPrefix: '/checkin' },
          {
            scheme: 'https',
            host: 'app.taikan.fit',
            pathPrefix: '/he/checkin',
          },
          {
            scheme: 'https',
            host: 'app.taikan.fit',
            pathPrefix: '/en/checkin',
          },
          {
            scheme: 'https',
            host: 'app.taikan.fit',
            pathPrefix: '/ru/checkin',
          },
          // Clerk invite ticket redirect target. Clerk's invitation
          // emails point at clerk.taikan.fit/v1/tickets/accept; after
          // server-side validation Clerk redirects to
          // https://app.taikan.fit/sign-up?__clerk_ticket=...&__clerk_status=sign_up
          // (per the JWT's rurl). This filter catches that redirect on
          // Android so the app handles invite acceptance instead of
          // the browser falling through to a web fallback. Requires
          // assetlinks.json on /.well-known/ — see FIT-188.
          {
            scheme: 'https',
            host: 'app.taikan.fit',
            pathPrefix: '/sign-up',
          },
          // FIT-178 token-gated form signing. Email/SMS links from
          // staff bulk-issuing compliance forms land here. Same
          // assetlinks.json + AASA file from FIT-188 cover this path.
          {
            scheme: 'https',
            host: 'app.taikan.fit',
            pathPrefix: '/forms/sign',
          },
          // Shop deep links (quick-register → shop landing, optionally
          // with ?plan=<id> to auto-open a plan's purchase). Locale
          // prefixes are stripped in-app by app/+native-intent.ts.
          { scheme: 'https', host: 'app.taikan.fit', pathPrefix: '/shop' },
          { scheme: 'https', host: 'app.taikan.fit', pathPrefix: '/he/shop' },
          { scheme: 'https', host: 'app.taikan.fit', pathPrefix: '/en/shop' },
          { scheme: 'https', host: 'app.taikan.fit', pathPrefix: '/ru/shop' },
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
      // it, neither OS shows Taikan in its per-app Language setting, so a
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
          'Taikan needs camera access to scan check-in QR codes.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Taikan uses your location to verify check-in at the gym.',
      },
    ],
    [
      'expo-notifications',
      {
        // Android renders this alpha-only, so it must be the FLAT mark in
        // white — a gradient is discarded by the OS. See brand kit §07.
        icon: './assets/images/notification-icon.png',
        color: '#0E8C8C',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-splash-screen',
      {
        // Cold-start splash: the brand globe centred on the Taikan splash
        // background. Handled off to the animated <AnimatedSplash> overlay
        // (src/components/animated-splash.tsx) — keep bg + imageWidth in
        // sync with it so the native → animated transition is seamless.
        backgroundColor: '#F6F8FA',
        dark: { backgroundColor: '#07202B' },
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
        organization: process.env.SENTRY_ORG ?? 'taikan',
        project: process.env.SENTRY_PROJECT ?? 'taikan-mobile',
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
    // Which commit this bundle came from — see `resolveCommit` above.
    commit: resolveCommit(),
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ?? '1c14f37d-bd36-4464-b848-249b5dec4831',
    },
  },
  // An OTA update is only delivered to installed apps whose runtimeVersion
  // matches the one it was published under — and under this policy that
  // string IS `version` above. So the version bump is not bookkeeping when a
  // release adds or changes native code: it is the mechanism that stops a JS
  // bundle reaching a binary that cannot run it.
  //
  // 1.0.5 is exactly that case. It adds @react-native-community/netinfo, and
  // `src/lib/network.ts` calls into it from `QueryProvider` — above every
  // screen — so a 1.0.4 binary pulling this bundle would hit a missing native
  // module on the first render and fail to boot. Shipping it as an OTA under
  // an unchanged version would brick every installed copy. It needs a new
  // store build, which is what the bump forces.
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url:
      process.env.EAS_UPDATES_URL ??
      'https://u.expo.dev/1c14f37d-bd36-4464-b848-249b5dec4831',
  },
});
