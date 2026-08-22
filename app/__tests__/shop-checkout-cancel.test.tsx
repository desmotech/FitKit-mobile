/**
 * Shop → what happens when a checkout does not complete.
 *
 * Closing the hosted payment page used to be a silent non-event on the
 * client: whatever came back that wasn't an explicit success was called
 * "cancelled", the subscription list was never refetched, and the member
 * landed on a screen that told them to try again from a shop still rendering
 * pre-checkout state. A declined card was reported the same way as walking
 * away. This pins the three-way outcome, the refetch, and the resume path
 * that reuses the pending subscription instead of buying a second one.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { PostHog } from 'posthog-react-native';
import * as WebBrowser from 'expo-web-browser';
import ShopScreen from '../(tabs)/shop/index';
import { setAnalyticsConsent } from '@/lib/analytics';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
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

const openAuth = WebBrowser.openAuthSessionAsync as jest.Mock;

const phClient = new (PostHog as unknown as new (
  key: string,
) => Record<string, jest.Mock>)('phc_test');

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
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  providerPriceId: null,
};

const PENDING_SUB = subscriptionWithPlan({
  id: 'sub_pending',
  planId: PLAN.id,
  status: 'pending',
  plan: PLAN,
} as never);

function stageShop({ subs = [] as unknown[] } = {}) {
  stageSignedInMember();
  const state = { subsFetches: 0, purchases: [] as unknown[], resumes: [] as unknown[] };
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: [PLAN] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-config`), () =>
      HttpResponse.json({ data: { isActive: true, status: 'active' } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () => {
      state.subsFetches += 1;
      return HttpResponse.json({ data: subs });
    }),
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
    http.post(api(`/organizations/${TEST_ORG}/plans/${PLAN.id}/purchase`), async ({ request }) => {
      state.purchases.push(await request.json());
      return HttpResponse.json({
        data: {
          subscription: { id: 'sub_new', status: 'pending', planId: PLAN.id },
          paymentPageUrl: 'https://pay.example/checkout',
        },
      });
    }),
    http.post(
      api(
        `/organizations/${TEST_ORG}/subscriptions/my/${PENDING_SUB.id}/resume-checkout`,
      ),
      async ({ request }) => {
        state.resumes.push(await request.json());
        return HttpResponse.json({
          data: {
            subscription: PENDING_SUB,
            paymentPageUrl: 'https://pay.example/redo',
            resuming: true,
          },
        });
      },
    ),
  );
  return state;
}

beforeEach(() => {
  mockRouterPush.mockClear();
  openAuth.mockReset();
  setAnalyticsConsent(true);
  phClient.capture.mockClear();
  phClient.getFeatureFlag.mockImplementation(() => undefined);
});

describe('Shop checkout that does not complete', () => {
  it('routes to the decision screen and tracks a cancellation', async () => {
    const state = stageShop();
    openAuth.mockResolvedValue({ type: 'dismiss' });
    const user = userEvent.setup();
    await renderWithProviders(<ShopScreen />);

    await user.press(await screen.findByTestId(`plan-cta-${PLAN.id}`));

    await waitFor(() =>
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: { status: 'cancelled', sub: 'sub_new' },
      }),
    );
    expect(state.purchases).toHaveLength(1);
    const events = phClient.capture.mock.calls.map((c) => c[0]);
    expect(events).toContain('member_checkout_cancelled');
    expect(events).not.toContain('member_checkout_failed');
  });

  it('keeps a declined card distinct from a cancelled one', async () => {
    stageShop();
    openAuth.mockResolvedValue({
      type: 'success',
      url: 'taikan://shop/payment-return?status=failed',
    });
    const user = userEvent.setup();
    await renderWithProviders(<ShopScreen />);

    await user.press(await screen.findByTestId(`plan-cta-${PLAN.id}`));

    await waitFor(() =>
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: { status: 'failed', sub: 'sub_new' },
      }),
    );
    const events = phClient.capture.mock.calls.map((c) => c[0]);
    expect(events).toContain('member_checkout_failed');
    expect(events).not.toContain('member_checkout_cancelled');
  });

  it('refetches the subscription list before handing over to the decision screen', async () => {
    // The ghost `pending` row created by the abandoned checkout is what every
    // membership surface renders from — including the screen we route to.
    const state = stageShop();
    openAuth.mockResolvedValue({ type: 'dismiss' });
    const user = userEvent.setup();
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(state.subsFetches).toBeGreaterThan(0));
    const before = state.subsFetches;

    await user.press(await screen.findByTestId(`plan-cta-${PLAN.id}`));

    await waitFor(() => expect(state.subsFetches).toBeGreaterThan(before));
  });
});

describe('Shop resume of a pending checkout', () => {
  it('reuses the pending subscription instead of buying the plan twice', async () => {
    const state = stageShop({ subs: [PENDING_SUB] });
    openAuth.mockResolvedValue({
      type: 'success',
      url: 'taikan://shop/payment-return?status=success',
    });
    const user = userEvent.setup();
    await renderWithProviders(<ShopScreen />);

    // The card explains why it is asking for payment on a plan the member
    // believes they already bought.
    expect(await screen.findByTestId('plan-pending-hint')).toBeTruthy();

    await user.press(await screen.findByTestId(`plan-cta-${PLAN.id}`));

    await waitFor(() => expect(state.resumes).toHaveLength(1));
    expect(state.purchases).toHaveLength(0);
    await waitFor(() =>
      expect(openAuth).toHaveBeenCalledWith(
        'https://pay.example/redo',
        expect.any(String),
      ),
    );
    await waitFor(() =>
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: { status: 'success', sub: PENDING_SUB.id },
      }),
    );
  });
});
