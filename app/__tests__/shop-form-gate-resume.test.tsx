/**
 * Compliance-gated purchase, across the two screens it spans.
 *
 * A member taps Subscribe, the API answers 409 `form_signature_required`,
 * and the shop hands them to the sign screen carrying the plan. Leaving
 * that screen hands the plan straight back as a `?plan=` landing, so they
 * arrive on the shop's spotlight + confirm instead of a bare list.
 *
 * The invariant these specs exist to protect: NO auto-checkout. Returning
 * from a signature must never create a payment session (or silently enroll
 * a free plan) without the member tapping confirm.
 *
 * The landing latch is the part that used to break this. It was scoped to
 * the mount, and this tab stays mounted while the member is off signing —
 * so a member who ARRIVED on a quick-register `?plan=` link had already
 * burned it, and the hand-back was swallowed.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { dictionaries } from '@fitkit/shared';
import { formStringsFor } from '@/i18n/form-strings';
import ShopScreen from '../(tabs)/shop/index';
import SignFormInstanceScreen from '../(tabs)/profile/forms/[instanceId]';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterNavigate = jest.fn();
const mockRouterBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    navigate: mockRouterNavigate,
    back: mockRouterBack,
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(() => ({ queryParams: { status: 'success' } })),
}));

const PLAN = {
  id: 'plan_gated',
  organizationId: TEST_ORG,
  name: 'Unlimited Monthly',
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

const INSTANCE_ID = 'fi_regulations';

/** The card's purchase CTA, in the test locale (Hebrew). */
const PURCHASE_CTA = dictionaries.he.shop.planCard.purchase;
const RESUME_CTA = formStringsFor('he').signedResumePurchase;
const DONE_CTA = formStringsFor('he').signedAction;

/** The confirm button of the last Alert.alert call. */
function confirmButton(): AlertButton {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
  return buttons.find((b) => b.style !== 'cancel')!;
}

/** A 409 the API answers with, lazily minting the instance to sign. */
function signatureRequired() {
  return HttpResponse.json(
    {
      code: 'form_signature_required',
      message: 'Purchase requires signing: Club Regulations',
      // Sibling of `code` — the client lifts every non-message/code field
      // into ApiError.details (hooks/use-api.ts).
      requirements: [
        {
          typeKey: 'regulations',
          formId: 'form_reg',
          formName: 'Club Regulations',
          status: 'pending',
          instanceId: INSTANCE_ID,
        },
      ],
    },
    { status: 409 },
  );
}

function stageShop({
  gate,
  purchaseCalls,
}: {
  gate: boolean;
  purchaseCalls?: unknown[];
}) {
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
        return gate
        ? signatureRequired()
        : HttpResponse.json({
            data: {
              subscription: subscriptionWithPlan({
                id: 'sub_new',
                planId: PLAN.id,
              } as never),
              paymentPageUrl: 'https://pay.test.local/checkout/gated',
              },
            });
      },
    ),
  );
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockParams = {};
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockRouterNavigate.mockClear();
  mockRouterBack.mockClear();
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockClear();
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: 'success',
    url: 'fitkit://shop/payment-return?status=success',
  });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('Shop → compliance gate', () => {
  it('routes a 409 form_signature_required to the sign screen carrying the plan', async () => {
    stageShop({ gate: true });
    await renderWithProviders(<ShopScreen />);
    const user = userEvent.setup();

    await screen.findByText(PLAN.name);
    await user.press(screen.getByText(PURCHASE_CTA));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/profile/forms/[instanceId]',
        params: {
          instanceId: INSTANCE_ID,
          reason: 'purchase',
          resumePlanId: PLAN.id,
        },
      });
    });
    // A gate is not a failure — no dead-end alert.
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('Shop landing latch', () => {
  it('confirms before checkout on the hand-back — never resumes a payment session on its own', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ gate: false, purchaseCalls });
    mockParams = { plan: PLAN.id };
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    // The whole point: landing back from a signature authorises nothing.
    expect(purchaseCalls).toHaveLength(0);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();

    await act(async () => {
      confirmButton().onPress?.();
    });
    await waitFor(() => expect(purchaseCalls).toHaveLength(1));
  });

  it('re-arms for a second landing once the param clears — the sign hand-back is not swallowed', async () => {
    stageShop({ gate: false });
    mockParams = { plan: PLAN.id };
    const { rerender } = await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));

    // The screen clears ?plan= once handled; the shop tab stays mounted
    // while the member is off signing.
    mockParams = {};
    await act(async () => {
      rerender(<ShopScreen />);
    });

    // Signing hands the same plan back as a fresh landing.
    mockParams = { plan: PLAN.id };
    await act(async () => {
      rerender(<ShopScreen />);
    });
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
  });

  it('stays one-shot while the same landing is still on the params', async () => {
    stageShop({ gate: false });
    mockParams = { plan: PLAN.id };
    const { rerender } = await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await act(async () => {
      rerender(<ShopScreen />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});

function stageInstance(status: string) {
  stageSignedInMember();
  server.use(
    http.get(
      api(`/organizations/${TEST_ORG}/forms/instances/${INSTANCE_ID}`),
      () =>
        HttpResponse.json({
          data: {
            instance: {
              id: INSTANCE_ID,
              status,
              kind: 'compliance',
              answers: {},
              archivedAt: null,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            form: {
              id: 'form_reg',
              name: 'Club Regulations',
              locale: 'he',
              fields: [],
              requiresSignature: true,
            },
          },
        }),
    ),
  );
}

describe('Sign screen → back to the purchase', () => {
  it('hands the plan back as a ?plan= landing when the gate is already satisfied', async () => {
    mockParams = {
      instanceId: INSTANCE_ID,
      reason: 'purchase',
      resumePlanId: PLAN.id,
    };
    stageInstance('signed');
    await renderWithProviders(<SignFormInstanceScreen />);
    const user = userEvent.setup();

    await user.press(await screen.findByText(RESUME_CTA));
    // `navigate`, not `replace`: neither @react-navigation's TabRouter nor
    // expo-router's NativeBottomTabsRouter implements REPLACE, so replacing
    // onto a tab route is silently unhandled and the member never leaves this
    // screen. This assertion passed against `replace` for as long as the mock
    // accepted either — the defect only ever showed on a device.
    expect(mockRouterNavigate).toHaveBeenCalledWith({
      pathname: '/(tabs)/shop',
      params: { plan: PLAN.id },
    });
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('pops back to My Forms when no purchase sent them here', async () => {
    mockParams = { instanceId: INSTANCE_ID };
    stageInstance('signed');
    await renderWithProviders(<SignFormInstanceScreen />);
    const user = userEvent.setup();

    await user.press(await screen.findByText(DONE_CTA));
    expect(mockRouterBack).toHaveBeenCalled();
    expect(mockRouterNavigate).not.toHaveBeenCalled();
  });
});
