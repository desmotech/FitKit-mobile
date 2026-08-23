/**
 * Global test setup (jest.config.js `setupFilesAfterEnv`).
 *
 * Mock policy: mock at the app's edges only — native modules that cannot run
 * in Node (mmkv, haptics) and third-party SDKs (Clerk, Sentry, PostHog,
 * sockets). Never mock app code (hooks, components, lib): tests must exercise
 * the same code paths users do, so refactors that keep behavior keep tests
 * green.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock
   factories run before imports are hoisted; require() is the only option. */
import type React from 'react';
import { configure } from '@testing-library/react-native';
import { server } from './msw';

// findBy*/waitFor default to 1s — too tight for CI runners where a screen
// chains two fetches (users/me → data) before its first meaningful paint.
// 5s changes nothing when green; it only buys headroom under load.
configure({ asyncUtilTimeout: 5000 });

// Fail loudly on any request a test didn't stage a handler for.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jest-expo's expo-constants carries no `extra` (app.config's env mapping
// doesn't run under jest), so give the analytics singleton a PostHog key
// here — without one the (mocked) PostHog client never constructs and
// feature flags could never be staged. Must live in THIS file: ./msw's
// import chain loads @/lib/api, which snapshots expo-constants at load.
// Harmless otherwise — analytics stays consent-gated (off by default).
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  const base = actual.default ?? actual;
  return {
    __esModule: true,
    ...actual,
    default: {
      ...base,
      expoConfig: {
        ...(base.expoConfig ?? {}),
        extra: {
          ...(base.expoConfig?.extra ?? {}),
          posthogKey: 'phc_test',
          // The real app always has one (app.config.ts). Without it
          // `usePushNotifications` bails before it can mint a token, so any
          // test of registration would silently exercise nothing.
          eas: { ...(base.expoConfig?.extra?.eas ?? {}), projectId: 'proj_test' },
        },
      },
    },
  };
});

// Official in-memory mock: insets are zero, which is fine for behavior tests.
// It exposes everything on `default`, so spread it up for named imports.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return { ...(mock.default ?? mock) };
});

// Reanimated's official mock — animations resolve instantly; the real module
// initializes native worklets at import time and crashes under Jest. The
// worklets runtime must be mocked first: even reanimated's own mock imports
// it transitively.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock'),
);
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // The official mock doesn't ship useReducedMotion (FKLoadingBar uses it);
  // reduced motion also keeps loaders static under test.
  return Object.assign(mock, {
    useReducedMotion: mock.useReducedMotion ?? (() => true),
  });
});

// Clerk: importing the real SDK starts background work that holds the Jest
// event loop open, and tests must never talk to Clerk anyway. Hook results
// are driven by the mutable state in test/mocks/clerk.ts.
jest.mock('@clerk/clerk-expo', () => {
  const { mockAuthState, mockUserState, mockSignIn, mockSignUp } =
    require('./mocks/clerk') as typeof import('./mocks/clerk');
  return {
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    ClerkLoaded: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => mockAuthState,
    useUser: () => ({
      isLoaded: true,
      isSignedIn: mockAuthState.isSignedIn,
      user: mockUserState.user,
    }),
    useSignIn: () => mockSignIn,
    useSignUp: () => mockSignUp,
    useClerk: () => ({ signOut: mockAuthState.signOut }),
  };
});

afterEach(() => {
  const { resetClerkMocks } = require('./mocks/clerk') as typeof import('./mocks/clerk');
  resetClerkMocks();
});

// react-native-keyboard-controller binds native keyboard events at import
// time; its official mock stands in for the native module under Jest.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);

// expo-clipboard is a native module (and UIPasteControl can't render under
// Jest). Backed by test/mocks/clipboard.tsx so a test can stage clipboard
// contents and pick the paste-button branch.
jest.mock('expo-clipboard', () => {
  const mocks = require('./mocks/clipboard') as typeof import('./mocks/clipboard');
  return {
    get isPasteButtonAvailable() {
      return mocks.mockClipboard.pasteButtonAvailable;
    },
    hasStringAsync: async () => mocks.mockClipboard.text != null,
    getStringAsync: async () => mocks.mockClipboard.text ?? '',
    ClipboardPasteButton: mocks.MockClipboardPasteButton,
  };
});

afterEach(() => {
  const { resetClipboardMock } =
    require('./mocks/clipboard') as typeof import('./mocks/clipboard');
  resetClipboardMock();
});

// AsyncStorage backs the query persister and settings-store; use the
// official in-memory mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-mmkv is a JSI module; back it with an in-memory Map.
jest.mock('react-native-mmkv', () => {
  class MMKV {
    private store = new Map<string, string | number | boolean>();
    set(key: string, value: string | number | boolean) {
      this.store.set(key, value);
    }
    getString(key: string) {
      const v = this.store.get(key);
      return typeof v === 'string' ? v : undefined;
    }
    getNumber(key: string) {
      const v = this.store.get(key);
      return typeof v === 'number' ? v : undefined;
    }
    getBoolean(key: string) {
      const v = this.store.get(key);
      return typeof v === 'boolean' ? v : undefined;
    }
    contains(key: string) {
      return this.store.has(key);
    }
    delete(key: string) {
      this.store.delete(key);
    }
    getAllKeys() {
      return [...this.store.keys()];
    }
    clearAll() {
      this.store.clear();
    }
  }
  return { MMKV, useMMKVString: jest.fn(), useMMKVBoolean: jest.fn() };
});

// expo-notifications pulls an untransformed ESM polyfill (abort-controller)
// and talks to native push infra; tests exercise the flows around it.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: null })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  setBadgeCountAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));

// Crash/analytics SDKs phone home; tests never should.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  wrap: (component: unknown) => component,
}));

jest.mock('posthog-react-native', () => {
  const client = {
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    optIn: jest.fn(),
    optOut: jest.fn(),
    screen: jest.fn(),
    group: jest.fn(),
    register: jest.fn(),
    getSessionId: jest.fn(),
    // Session replay lives in a native module; under Jest these are just
    // the calls src/lib/analytics.ts makes when consent flips.
    startSessionRecording: jest.fn(),
    stopSessionRecording: jest.fn(),
    isSessionReplayActive: jest.fn(),
    // Feature flags (use-feature-flag.ts): default = flag undecided/off.
    // Specs override getFeatureFlag's return to stage a flag ON.
    getFeatureFlag: jest.fn(),
    onFeatureFlags: jest.fn(() => () => {}),
    reloadFeatureFlags: jest.fn(),
  };
  const PostHogCtor = jest.fn(() => client);
  return {
    __esModule: true,
    // src/lib/analytics.ts constructs via the DEFAULT export; specs stage
    // flags through the named one — both must be the same jest.fn.
    default: PostHogCtor,
    PostHog: PostHogCtor,
    PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
    // Masking is a native concern — render children so the screens that wrap
    // themselves in it stay queryable.
    PostHogMaskView: ({ children }: { children: React.ReactNode }) => children,
    usePostHog: () => client,
  };
});

// NetInfo is a native module — it has no JS implementation under Jest. The
// package's own mock reports a connected wifi interface, which is the right
// default: every existing spec assumes requests go through, and react-query's
// `onlineManager` (bound to NetInfo in src/lib/network.ts) would otherwise
// pause every query the moment a suite touched the real module. Specs that
// exercise the offline queue drive `onlineManager` directly instead of
// simulating an interface — it is the boundary the app actually reads.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);
