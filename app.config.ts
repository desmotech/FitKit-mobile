import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FitKit',
  slug: 'fitkit',
  scheme: 'fitkit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F6F8FA',
    dark: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0A1628',
    },
  },
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
  },
  android: {
    package: 'fit.fitkit.app',
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
    'expo-localization',
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
        locationAlwaysAndWhenInUsePermission:
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
        backgroundColor: '#F6F8FA',
        dark: { backgroundColor: '#0A1628' },
        image: './assets/images/splash.png',
        imageWidth: 200,
      },
    ],
    [
      'expo-video',
      {
        // Embedded exercise demos auto-pause when the screen unmounts;
        // background playback isn't needed and adds entitlement weight.
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: true,
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
