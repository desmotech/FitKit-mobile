/**
 * Hidden plans never render in the Shop tab — whoever is looking.
 *
 * The API filters `showInShop=false` rows out of member responses, but staff
 * roles (owner/admin/coach) receive the FULL catalog because the same
 * endpoint feeds the web dashboard's plan management. The storefront must
 * honor the flag itself, or a staff account browsing the mobile shop sees
 * plans the org deliberately hid (the regression this pins).
 */
import { screen, waitFor } from '@testing-library/react-native';
import ShopScreen from '../(tabs)/shop/index';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(() => ({ queryParams: {} })),
}));

const basePlan = {
  organizationId: TEST_ORG,
  description: null,
  type: 'subscription',
  programId: null,
  priceInCents: 30000,
  currency: 'ILS',
  interval: 'month',
  classCredits: null,
  maxBookingsPerDay: null,
  maxBookingsPerWeek: null,
  allowOverlappingBookings: false,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  providerPriceId: null,
};

const VISIBLE_PLAN = {
  ...basePlan,
  id: 'plan_visible',
  name: 'Standard Membership',
  showInShop: true,
};

const HIDDEN_PLAN = {
  ...basePlan,
  id: 'plan_hidden',
  name: 'Secret Legacy Plan',
  sortOrder: 1,
  showInShop: false,
};

// No showInShop at all — older API builds predate the flag; absent must
// keep the plan visible, not hide the whole shop.
const LEGACY_PLAN = {
  ...basePlan,
  id: 'plan_legacy',
  name: 'Legacy Rate',
  sortOrder: 2,
};

function stageShop(plans: unknown[]) {
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: plans }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-config`), () =>
      HttpResponse.json({ data: { isActive: true } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
  );
}

describe('Shop hidden plans', () => {
  it('renders showInShop plans and drops hidden ones from a staff payload', async () => {
    stageShop([VISIBLE_PLAN, HIDDEN_PLAN, LEGACY_PLAN]);

    await renderWithProviders(<ShopScreen />);

    await waitFor(() => {
      expect(screen.getByText(VISIBLE_PLAN.name)).toBeTruthy();
    });
    expect(screen.getByText(LEGACY_PLAN.name)).toBeTruthy();
    expect(screen.queryByText(HIDDEN_PLAN.name)).toBeNull();
  });
});
