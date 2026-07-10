/**
 * Runs before the Jest test framework loads (jest.config.js `setupFiles`).
 * Keep to globals/polyfills only — mocks belong in test/setup.ts.
 */

// socket.io-client and MSW expect a browser-ish global in some paths.
process.env.EXPO_PUBLIC_API_URL ??= 'http://api.test.local';
