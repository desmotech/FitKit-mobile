/**
 * Shop deep-link landing (`/shop?plan=<id>`) — pins the quick-register /
 * QR flow: landing with a purchasable plan auto-initiates its checkout
 * exactly once; an unknown plan id degrades to the plain shop list; a plan
 * the member already holds does nothing.
 */
import { screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import ShopScreen from '../(tabs)/shop/index';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(() => ({ queryParams: { status: 'cancelled' } })),
}));

const PLAN = {
  id: 'plan_event',
  organizationId: TEST_ORG,
  name: 'Event Drop-in',
  description: null,
  type: 'drop_in',
  programId: null,
  priceInCents: 5000,
  currency: 'ILS',
  interval: null,
  classCredits: null,
  maxBookingsPerDay: null,
  maxBookingsPerWeek: null,
  allowOverlappingBookings: false,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  providerPriceId: null,
};

function stageShop({
  purchaseCalls,
}: { purchaseCalls?: unknown[] } = {}) {
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: [PLAN] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-config`), () =>
      HttpResponse.json({ data: { isActive: true } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(
      api(`/organizations/${TEST_ORG}/announcements/unread-count`),
      () => HttpResponse.json({ data: { count: 0 } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
      HttpResponse.json({ data: { conversations: [] } }),
    ),
    http.post(
      api(`/organizations/${TEST_ORG}/plans/${PLAN.id}/purchase`),
      async ({ request }) => {
        purchaseCalls?.push(await request.json());
        return HttpResponse.json({
          data: {
            subscription: subscriptionWithPlan({
              id: 'sub_new',
              planId: PLAN.id,
            } as never),
            paymentPageUrl: 'https://pay.test.local/checkout/evt',
          },
        });
      },
    ),
  );
}

beforeEach(() => {
  mockParams = {};
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockClear();
});

describe('Shop deep-link landing', () => {
  it('auto-opens checkout for a purchasable ?plan= target, once', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ purchaseCalls });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });
    mockParams = { plan: PLAN.id };

    await renderWithProviders(<ShopScreen />);
    await waitFor(() => {
      expect(purchaseCalls).toHaveLength(1);
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://pay.test.local/checkout/evt',
      'fitkit://shop/payment-return',
    );
    // One-shot: no second launch after re-renders settle.
    await waitFor(() => {
      expect(purchaseCalls).toHaveLength(1);
    });
  });

  it('degrades to the plain shop list for an unknown plan id', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ purchaseCalls });
    mockParams = { plan: 'plan_nonexistent' };

    await renderWithProviders(<ShopScreen />);
    await waitFor(() => {
      expect(screen.getByText(PLAN.name)).toBeTruthy();
    });
    expect(purchaseCalls).toHaveLength(0);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
