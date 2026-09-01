/**
 * Compliance-gated purchase, across the two screens it spans.
 *
 * A member taps Subscribe, the API answers 409 `form_signature_required`,
 * and the shop hands them to the sign screen — in the SHOP stack, so no
 * tab flip — carrying the plan. Signing (or leaving an already-satisfied
 * gate) arms the in-memory purchase-resume latch and hands the plan back
 * as a `?plan=` landing, which the shop consumes and continues straight
 * into checkout: the Purchase tap that opened the gate was the confirm.
 *
 * The invariant these specs exist to protect: a BARE `?plan=` landing —
 * QR, marketing link, anything external — must never create a payment
 * session (or silently enroll a free plan) without the member tapping
 * confirm. Only the sign screen's own code can arm the latch; it rides
 * module memory, not URL-space, precisely so a link can't forge it.
 *
 * The landing latch is the part that used to break the hand-back. It was
 * scoped to the mount, and this tab stays mounted while the member is off
 * signing — so a member who ARRIVED on a quick-register `?plan=` link had
 * already burned it, and the hand-back was swallowed.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { dictionaries } from '@taikan/shared';
import { formStringsFor } from '@/i18n/form-strings';
import ShopScreen from '../(tabs)/shop/index';
import SignFormInstanceScreen from '../(tabs)/profile/forms/[instanceId]';
import {
  armPurchaseResume,
  consumePurchaseResume,
} from '@/lib/purchase-resume';
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
  // Any consume clears the module-level latch, whatever it holds.
  consumePurchaseResume('__reset__');
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockRouterNavigate.mockClear();
  mockRouterBack.mockClear();
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockClear();
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: 'success',
    url: 'taikan://shop/payment-return?status=success',
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
      // The shop-stack copy of the sign screen — routing to the profile
      // tab's copy flipped the member two tabs away mid-purchase.
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/sign/[instanceId]',
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
  it('confirms before checkout on a bare ?plan= landing — a link alone never creates a payment session', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ gate: false, purchaseCalls });
    mockParams = { plan: PLAN.id };
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    // The whole point: an external link authorises nothing.
    expect(purchaseCalls).toHaveLength(0);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();

    await act(async () => {
      confirmButton().onPress?.();
    });
    await waitFor(() => expect(purchaseCalls).toHaveLength(1));
  });

  it('continues straight into checkout on an armed hand-back — no second confirm', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ gate: false, purchaseCalls });
    // What the sign screen does on its way out.
    armPurchaseResume(PLAN.id);
    mockParams = { plan: PLAN.id };
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(purchaseCalls).toHaveLength(1));
    await waitFor(() =>
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled(),
    );
    // The Purchase tap that opened the gate was the confirm.
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('an armed latch for a DIFFERENT plan still confirms — and dies on consumption', async () => {
    const purchaseCalls: unknown[] = [];
    stageShop({ gate: false, purchaseCalls });
    armPurchaseResume('plan_other');
    mockParams = { plan: PLAN.id };
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(purchaseCalls).toHaveLength(0);
    // The mismatched landing consumed it — nothing left to fire later.
    expect(consumePurchaseResume('plan_other')).toBe(false);
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
  it('hands the plan back armed for auto-resume when the gate is already satisfied', async () => {
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
    // Armed for exactly this plan, so the shop skips the second confirm.
    expect(consumePurchaseResume(PLAN.id)).toBe(true);
  });

  it('backing out without resuming leaves nothing armed', async () => {
    mockParams = { instanceId: INSTANCE_ID };
    stageInstance('signed');
    await renderWithProviders(<SignFormInstanceScreen />);
    const user = userEvent.setup();

    await user.press(await screen.findByText(DONE_CTA));
    expect(consumePurchaseResume(PLAN.id)).toBe(false);
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
