/**
 * The dock reads in the member's direction — on a phone in ANY language.
 *
 * NativeTabs renders the real platform tab bar, and the OS lays that view
 * out itself: it mirrors the bar whenever it renders the app in an RTL
 * language. `I18nManager.allowRTL(false)` (see i18n-provider) governs React
 * Native's own layout and does not stop that. So the shell owes the bar a
 * flip only when the app's direction and the OS's DISAGREE — which is why
 * all four combinations are pinned here and not just the Hebrew ones.
 *
 * Reversing on `dir` alone was the original fix, and it was right only for a
 * Hebrew app on an English phone. On a Hebrew PHONE it double-flipped, and
 * the dock came out left-to-right for exactly the members who need it most
 * (reported from two phones side by side, 2026-09-01).
 *
 * The mock tab bar below does NOT mirror — no Node-side view does — so these
 * assertions read the order the shell HANDS to the platform. That is the
 * only half we control, and inverting it is precisely how the bug worked.
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
  it('hands the platform an unreversed row when nobody needs a flip', async () => {
    // English phone, English app. Neither side mirrors; Home leads.
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

  it('reverses for a Hebrew app on an English phone — the OS will not', async () => {
    // The OS lays the bar out left-to-right because it is rendering an
    // English app, so the reversal has to come from us: Home goes last in
    // the row we hand over, and lands on the RIGHT edge where Hebrew starts.
    stageFullShell();
    const L = labelsFor('he');

    await renderWithProviders(<TabsLayout />, { lang: 'he' });

    expect(await tabOrder()).toEqual([
      L.profile,
      L.shop,
      L.program,
      L.schedule,
      L.home,
    ]);
  });

  it('keeps hands off for a Hebrew app on a Hebrew phone — the OS already mirrored', async () => {
    // THE REGRESSION. The OS renders the app in Hebrew and mirrors the bar
    // itself, so handing it a reversed row flips it twice and the dock reads
    // left-to-right. Home must go FIRST here; the platform moves it right.
    //
    // No in-app override either — `lang = override ?? resolveDeviceLocale()`
    // — which is what a fresh install on a Hebrew phone does, and how this
    // reached members.
    stageFullShell();
    mockDeviceLocales = [{ languageCode: 'he' }];
    const L = labelsFor('he');

    await renderWithProviders(<TabsLayout />, { lang: null });

    expect(await tabOrder()).toEqual([
      L.home,
      L.schedule,
      L.program,
      L.shop,
      L.profile,
    ]);
  });

  it('reverses an English app on a Hebrew phone — undoing the OS mirror', async () => {
    // The mirror image of the row above, and broken the same way before this
    // fix: the OS mirrors the bar for a Hebrew phone whatever language the
    // member picked in-app, so an English app needs us to undo it.
    stageFullShell();
    mockDeviceLocales = [{ languageCode: 'he' }];
    const L = labelsFor('en');

    await renderWithProviders(<TabsLayout />, { lang: 'en' });

    expect(await tabOrder()).toEqual([
      L.profile,
      L.shop,
      L.program,
      L.schedule,
      L.home,
    ]);
  });

  it('treats a language the app does not ship as left-to-right', async () => {
    // A French phone gets no French bundle, so the OS falls back to the
    // development region and does NOT mirror. Reading the device direction
    // through `resolveDeviceLocale` would have answered `he` here — its
    // no-match fallback is the app default — and sent the bar out backwards
    // for every member on an unsupported LTR language.
    stageFullShell();
    mockDeviceLocales = [{ languageCode: 'fr' }];
    const L = labelsFor('he');

    await renderWithProviders(<TabsLayout />, { lang: 'he' });

    expect(await tabOrder()).toEqual([
      L.profile,
      L.shop,
      L.program,
      L.schedule,
      L.home,
    ]);
  });
});
