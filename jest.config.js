/**
 * Jest via the official Expo preset (React Native runtime, Babel transform,
 * Expo module mocks). Tests are colocated: `__tests__/` dirs or *.test.ts(x).
 *
 * Date-sensitive suites must pass in any host timezone — CI runs the suite
 * under a TZ matrix (UTC, Asia/Jerusalem, America/New_York) to prove it.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // jest-expo's default list, extended with untranspiled deps this app uses
  // (the msw cluster ships raw ESM).
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-svg|react-native-css-interop|nativewind|@rn-primitives|lucide-react-native|posthog-react-native|react-native-mmkv|react-native-keyboard-controller|react-native-reanimated|react-native-worklets|react-native-gesture-handler|msw|@mswjs|rettime|until-async|strict-event-emitter|outvariant|@open-draft|headers-polyfill|is-node-process|@bundled-es-modules|graphql))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  // jest-expo only transforms .[jt]sx? — extend to the .mjs files msw's
  // dependency graph ships.
  transform: {
    '\\.m?[jt]sx?$': [
      'babel-jest',
      { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'mjs', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
};
