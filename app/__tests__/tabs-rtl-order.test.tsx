/**
 * The dock reads right-to-left in Hebrew.
 *
 * `I18nManager.allowRTL(false)` (see i18n-provider) opts this whole app out
 * of the OS's automatic RTL mirroring, so nothing flips the tab bar for us:
 * the trigger order is plain JSX order unless the shell reverses it itself.
 * That reversal is a single line in `app/(tabs)/_layout.tsx` with nothing
 * pinning it — exactly the kind of line a refactor of the return block drops
 * without a single failure. It has been fixed once already; this is the test
 * that was missing.
 *
 * Both inputs to `dir` are covered, because a member can arrive at Hebrew
 * two ways: an explicit in-app choice, or a Hebrew device with no choice
 * made (`lang = override ?? resolveDeviceLocale(locales)`).
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@taikan/shared';
import TabsLayout from '../(tabs)/_layout';
import { stageSignedInMember } from '../../test/fixtures';
import { mockAuthState } from '../../test/mocks/clerk';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

// The real NativeTabs renders a platform UITabBar that cannot mount under
// Jest. This stand-in keeps the ONE property the test is about — the order
// its children are handed to it in.
/* eslint-disable @typescript-eslint/no-require-imports, react/display-name --
   jest.mock factories are hoisted above imports, so require() is the only
   way in; the stand-ins are three-line render functions, not components
   anyone debugs by name. */
jest.mock('expo-router/unstable-native-tabs', () => {
  const ReactLib = require('react');
  const { Text, View } = require('react-native');
  // Types stay inline: babel-plugin-jest-hoist reads even an erased type
  // alias declared in here as an out-of-scope variable and refuses the file.
  const Trigger = ({ children }: { children?: unknown }) =>
    ReactLib.createElement(View, null, children);
  Trigger.Label = ({ children }: { children?: unknown }) =>
    ReactLib.createElement(Text, { testID: 'tab-label' }, children);
  Trigger.Icon = () => null;
  Trigger.Badge = ({ children }: { children?: unknown }) =>
    ReactLib.createElement(Text, { testID: 'tab-badge' }, children);
  const NativeTabs = ({ children }: { children?: unknown }) =>
    ReactLib.createElement(View, { testID: 'native-tabs' }, children);
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
/* eslint-enable @typescript-eslint/no-require-imports, react/display-name */

// The OS locale list, so the device-locale half of `dir` can be staged.
// `useLocales()` reads a native setting that has no meaning under Jest.
let mockDeviceLocales: { languageCode: string | null }[] = [
  { languageCode: 'en' },
];
jest.mock('expo-localization', () => ({
  useLocales: () => mockDeviceLocales,
  getLocales: () => mockDeviceLocales,
}));

beforeEach(() => {
  mockDeviceLocales = [{ languageCode: 'en' }];
});

// Navigation edge: AuthGate redirects and usePendingIntent routes. Neither
// is what this spec is about, and mounting a real navigator is not needed
// to read trigger order.
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/(tabs)',
  useGlobalSearchParams: () => ({}),
}));

const ALL_CONSENTED = [
  'terms_of_use',
  'privacy_policy',
  'fitness_waiver',
].map((documentType) => ({
  documentType,
  documentVersion: '1.0',
  documentId: `doc_${documentType}`,
  consentedAt: '2026-01-01T00:00:00.000Z',
  isCurrentVersion: true,
  requiresReconsent: false,
}));

const PLAN = {
  id: 'plan_gold',
  organizationId: TEST_ORG,
  name: 'Gold Unlimited',
  description: null,
  type: 'subscription',
  programId: null,
  priceInCents: 45000,
  currency: 'ILS',
  interval: 'monthly',
  classCredits: null,
  maxBookingsPerDay: null,
  maxBookingsPerWeek: null,
  allowOverlappingBookings: false,
  isActive: true,
  showInShop: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  providerPriceId: null,
};

const SCHEDULE_PROGRAM = {
  id: 'prog_classes',
  organizationId: TEST_ORG,
  name: 'CrossFit Classes',
  deliveryMode: 'schedule',
};

const COACHING_PROGRAM = {
  id: 'prog_coaching',
  organizationId: TEST_ORG,
  name: 'Personal Training',
  deliveryMode: 'coaching',
};

/** Every gate open, so all five triggers render and order is unambiguous. */
function stageFullShell() {
  mockAuthState.isSignedIn = true;
  stageSignedInMember();
  server.use(
    // All three documents consented. An EMPTY list is not "nothing to do" —
    // AuthGate reads it as all three missing and redirects to accept-terms,
    // and the shell under test never mounts.
    http.get(api('/legal/consents/status'), () =>
      HttpResponse.json({ data: ALL_CONSENTED }),
    ),
    http.get(api('/users/me/pending-intent'), () =>
      HttpResponse.json({ data: null }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/programs/my-enrollments`), () =>
      HttpResponse.json({
        data: [
          { id: 'enr_1', programId: COACHING_PROGRAM.id, program: COACHING_PROGRAM },
        ],
      }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/programs`), () =>
      HttpResponse.json({ data: [SCHEDULE_PROGRAM, COACHING_PROGRAM] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: [PLAN] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-config`), () =>
      HttpResponse.json({ data: { isActive: true, status: 'active' } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/forms/mine`), () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
  );
}

/** The dock's labels, left to right as rendered. */
async function tabOrder(): Promise<string[]> {
  await waitFor(() => {
    expect(screen.getAllByTestId('tab-label').length).toBe(5);
  });
  return screen
    .getAllByTestId('tab-label')
    .map((node) => String(node.props.children));
}

/** Labels as the shell resolves them: `mobileTabs.*`, with `nav.shop` for
 *  the one key `mobileTabs` doesn't carry. */
function labelsFor(lang: 'he' | 'en') {
  const d = dictionaries[lang] as unknown as Record<
    string,
    Record<string, string>
  >;
  return {
    home: d.mobileTabs.home,
    schedule: d.mobileTabs.schedule,
    program: d.mobileTabs.program,
    shop: d.mobileTabs.shop ?? d.nav.shop,
    profile: d.mobileTabs.profile,
  };
}

describe('Tab dock direction', () => {
  it('runs left-to-right in English — Home first', async () => {
    stageFullShell();
    const L = labelsFor('en');

    await renderWithProviders(<TabsLayout />, { lang: 'en' });

    expect(await tabOrder()).toEqual([
      L.home,
      L.schedule,
      L.program,
      L.shop,
      L.profile,
    ]);
  });

  it('runs right-to-left when Hebrew is the chosen locale — Home last', async () => {
    stageFullShell();
    const L = labelsFor('he');

    await renderWithProviders(<TabsLayout />, { lang: 'he' });

    // Home is the primary tab, so it sits where the reading eye starts —
    // the RIGHT edge in Hebrew, which is the END of the rendered row.
    expect(await tabOrder()).toEqual([
      L.profile,
      L.shop,
      L.program,
      L.schedule,
      L.home,
    ]);
  });

  it('runs right-to-left on a Hebrew device with no in-app choice made', async () => {
    // `lang = override ?? resolveDeviceLocale(locales)` — passing no override
    // is what a fresh install does, so this is the OS-locale path, and the
    // half a member is most likely to hit.
    stageFullShell();
    mockDeviceLocales = [{ languageCode: 'he' }];
    const L = labelsFor('he');

    await renderWithProviders(<TabsLayout />, { lang: null });

    expect(await tabOrder()).toEqual([
      L.profile,
      L.shop,
      L.program,
      L.schedule,
      L.home,
    ]);
  });
});
