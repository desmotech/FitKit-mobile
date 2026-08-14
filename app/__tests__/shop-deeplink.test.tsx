/**
 * Shop deep-link landing (`/shop?plan=<id>`) — pins the quick-register /
 * QR flow: landing with a purchasable plan opens a native confirm dialog
 * (never auto-checkout — opening a link must not create a payment session
 * without a tap); confirming launches checkout; cancelling leaves the shop
 * untouched; an unknown plan id degrades to the plain shop list.
 */
import { act, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import ShopScreen from '../(tabs)/shop/index';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
const mockSetParams = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
    setParams: mockSetParams,
  }),
  useLocalSearchParams: () => mockParams,
  // The shop resumes a gated purchase on focus; run the callback like a
  // real focus would.
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
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
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

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockParams = {};
  mockSetParams.mockClear();
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
});

/** The confirm button of the last Alert.alert call. */
function confirmButton(): AlertButton {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
  return buttons.find((b) => b.style !== 'cancel')!;
}

describe('Shop deep-link landing', () => {
  it('opens a confirm dialog for a purchasable ?plan= target — checkout only after confirm', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ purchaseCalls });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });
    mockParams = { plan: PLAN.id };

    await renderWithProviders(<ShopScreen />);
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    // Landing alone must never create a payment session.
    expect(purchaseCalls).toHaveLength(0);
    // Param is cleared so a tab revisit can't re-trigger the landing.
    expect(mockSetParams).toHaveBeenCalledWith({ plan: undefined });

    await act(async () => {
      confirmButton().onPress?.();
    });
    await waitFor(() => {
      expect(purchaseCalls).toHaveLength(1);
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://pay.test.local/checkout/evt',
      'fitkit://shop/payment-return',
    );
    // One-shot: no second dialog after re-renders settle.
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('cancelling the dialog leaves the shop untouched', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ purchaseCalls });
    mockParams = { plan: PLAN.id };

    await renderWithProviders(<ShopScreen />);
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
    // Never pressing confirm — nothing may fire.
    expect(purchaseCalls).toHaveLength(0);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('degrades to the plain shop list for an unknown plan id', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ purchaseCalls });
    mockParams = { plan: 'plan_nonexistent' };

    await renderWithProviders(<ShopScreen />);
    await waitFor(() => {
      expect(screen.getByText(PLAN.name)).toBeTruthy();
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(purchaseCalls).toHaveLength(0);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
