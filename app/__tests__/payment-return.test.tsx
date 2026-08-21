/**
 * Shop → payment-return, the non-success legs.
 *
 * A checkout the member closed (or a card the provider declined) used to end
 * on "No payment was made. You can try again from the shop." — while the
 * `pending` subscription it created stayed on their profile asking them to
 * complete a payment they had just walked away from, with no way to clear it
 * before the 24h sweep. This pins the decision that replaced it: resume the
 * payment, or roll the purchase back.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import PaymentReturnScreen from '../(tabs)/shop/payment-return';
import { checkoutDecisionStringsFor } from '@/i18n/checkout-decision-strings';
import { cancelPendingStringsFor } from '@/i18n/cancel-pending-strings';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterReplace = jest.fn();
let mockRouteParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockRouterReplace,
    back: jest.fn(),
  }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

const openAuth = WebBrowser.openAuthSessionAsync as jest.Mock;

const D = checkoutDecisionStringsFor('he');
const CP = cancelPendingStringsFor('he');

const SUB_ID = 'sub_pending';

/** Every request this screen can make on a non-success leg. The return
 *  report is fire-and-forget, but MSW fails unhandled requests, so it is
 *  staged here and its calls are counted. */
function stageReturn({
  returns = [] as unknown[],
  cancels = [] as unknown[],
  resumes = [] as unknown[],
  resumeStatus = 200,
  paymentPageUrl = 'https://pay.example/redo',
} = {}) {
  stageSignedInMember();
  server.use(
    http.post(
      api(`/organizations/${TEST_ORG}/subscriptions/my/${SUB_ID}/checkout-return`),
      async ({ request }) => {
        returns.push(await request.json());
        return HttpResponse.json({ data: { ok: true } });
      },
    ),
    http.post(
      api(`/organizations/${TEST_ORG}/subscriptions/my/${SUB_ID}/cancel-pending`),
      async ({ request }) => {
        cancels.push(await request.json());
        return HttpResponse.json({ data: { id: SUB_ID, status: 'cancelled' } });
      },
    ),
    http.post(
      api(`/organizations/${TEST_ORG}/subscriptions/my/${SUB_ID}/resume-checkout`),
      async ({ request }) => {
        resumes.push(await request.json());
        if (resumeStatus !== 200) {
          return HttpResponse.json(
            { message: 'not resumable', code: 'CHECKOUT_NOT_RESUMABLE' },
            { status: resumeStatus },
          );
        }
        return HttpResponse.json({
          data: {
            subscription: { id: SUB_ID, status: 'pending' },
            paymentPageUrl,
            resuming: true,
          },
        });
      },
    ),
  );
  return { returns, cancels, resumes };
}

beforeEach(() => {
  mockRouteParams = { status: 'cancelled', sub: SUB_ID };
  mockRouterReplace.mockClear();
  openAuth.mockReset();
});

describe('PaymentReturnScreen — cancelled checkout', () => {
  it('offers both ways forward instead of a dead end', async () => {
    stageReturn();
    await renderWithProviders(<PaymentReturnScreen />);

    expect(await screen.findByTestId('payment-return-cancelled')).toBeTruthy();
    expect(screen.getByTestId('payment-return-resume-btn')).toBeTruthy();
    expect(screen.getByTestId('payment-return-cancel-purchase-btn')).toBeTruthy();
  });

  it('reports the landing to the API exactly once, fire and forget', async () => {
    const staged = stageReturn();
    await renderWithProviders(<PaymentReturnScreen />);

    await waitFor(() => expect(staged.returns).toHaveLength(1));
    expect(staged.returns[0]).toEqual({
      subscriptionId: SUB_ID,
      outcome: 'cancelled',
      client: 'mobile',
    });
  });

  it('keeps the plain ending when there is no subscription to act on', async () => {
    // A plan-change checkout replaces the subscription row, so there is
    // nothing pending to resume or roll back.
    mockRouteParams = { status: 'cancelled', planChange: '1', plan: 'plan_x' };
    stageSignedInMember();
    await renderWithProviders(<PaymentReturnScreen />);

    expect(await screen.findByTestId('payment-return-cancelled')).toBeTruthy();
    expect(screen.queryByTestId('payment-return-resume-btn')).toBeNull();
    expect(
      screen.queryByTestId('payment-return-cancel-purchase-btn'),
    ).toBeNull();
  });
});

describe('PaymentReturnScreen — declined payment', () => {
  it('says the payment failed rather than blaming the member for cancelling', async () => {
    mockRouteParams = { status: 'failed', sub: SUB_ID };
    stageReturn();
    await renderWithProviders(<PaymentReturnScreen />);

    expect(await screen.findByTestId('payment-return-failed')).toBeTruthy();
    expect(screen.getByText(D.failedTitle)).toBeTruthy();
    expect(screen.getByText(D.failedDesc)).toBeTruthy();
  });

  it('reports the failure outcome distinctly from a cancellation', async () => {
    mockRouteParams = { status: 'failed', sub: SUB_ID };
    const staged = stageReturn();
    await renderWithProviders(<PaymentReturnScreen />);

    await waitFor(() => expect(staged.returns).toHaveLength(1));
    expect((staged.returns[0] as { outcome: string }).outcome).toBe('failed');
  });

  it('offers the same decision as a cancelled one', async () => {
    mockRouteParams = { status: 'failed', sub: SUB_ID };
    stageReturn();
    await renderWithProviders(<PaymentReturnScreen />);

    expect(await screen.findByTestId('payment-return-resume-btn')).toBeTruthy();
    expect(screen.getByTestId('payment-return-cancel-purchase-btn')).toBeTruthy();
  });
});

describe('PaymentReturnScreen — resume', () => {
  it('re-issues a page for the SAME subscription and reopens the browser', async () => {
    const staged = stageReturn();
    openAuth.mockResolvedValue({
      type: 'success',
      url: 'fitkit://shop/payment-return?status=success',
    });
    const user = userEvent.setup();
    await renderWithProviders(<PaymentReturnScreen />);

    await user.press(await screen.findByTestId('payment-return-resume-btn'));

    await waitFor(() => expect(staged.resumes).toHaveLength(1));
    // Never a fresh purchase: that would mint a second pending row for a
    // plan the member is already halfway through buying.
    expect(staged.resumes[0]).toMatchObject({ subscriptionId: SUB_ID });
    await waitFor(() => expect(openAuth).toHaveBeenCalledTimes(1));
    expect(openAuth.mock.calls[0][0]).toBe('https://pay.example/redo');
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: { status: 'success', sub: SUB_ID },
      }),
    );
  });

  it('lands back on the failed leg when the retry is declined too', async () => {
    stageReturn();
    openAuth.mockResolvedValue({
      type: 'success',
      url: 'fitkit://shop/payment-return?status=failed',
    });
    const user = userEvent.setup();
    await renderWithProviders(<PaymentReturnScreen />);

    await user.press(await screen.findByTestId('payment-return-resume-btn'));

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: { status: 'failed', sub: SUB_ID },
      }),
    );
  });

  it('explains a refusal instead of opening nothing', async () => {
    // 409 CHECKOUT_NOT_RESUMABLE — the row was paid, swept or voided while
    // the member sat on this screen.
    stageReturn({ resumeStatus: 409 });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithProviders(<PaymentReturnScreen />);

    await user.press(await screen.findByTestId('payment-return-resume-btn'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(openAuth).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

/**
 * The API names the subscription on every return leg now (`&sub=`), not just
 * success. The screen must act on the row the leg names — a resumed checkout
 * can settle on a different one — and, when no leg and no route param carry
 * an id, must NOT fall back to guessing at a pending subscription: rolling
 * back the wrong one cancels a checkout the member never abandoned.
 */
describe('PaymentReturnScreen — which subscription the leg names', () => {
  it('follows the id the return leg carries over the one it came in with', async () => {
    const staged = stageReturn();
    openAuth.mockResolvedValue({
      type: 'success',
      url: 'fitkit://shop/payment-return?status=cancelled&sub=sub_other',
    });
    const user = userEvent.setup();
    await renderWithProviders(<PaymentReturnScreen />);

    await user.press(await screen.findByTestId('payment-return-resume-btn'));

    await waitFor(() => expect(staged.resumes).toHaveLength(1));
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: { status: 'cancelled', sub: 'sub_other' },
      }),
    );
  });

  it('offers the payments screen, not a guess, when nothing names a subscription', async () => {
    mockRouteParams = { status: 'cancelled' };
    stageSignedInMember();
    await renderWithProviders(<PaymentReturnScreen />);

    expect(await screen.findByTestId('payment-return-cancelled')).toBeTruthy();
    expect(screen.queryByTestId('payment-return-resume-btn')).toBeNull();
    expect(
      screen.queryByTestId('payment-return-cancel-purchase-btn'),
    ).toBeNull();

    const link = screen.getByTestId('payment-return-payments-link');
    await userEvent.setup().press(link);
    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/profile/payments');
  });

  it('says so on the failed leg too', async () => {
    mockRouteParams = { status: 'failed' };
    stageSignedInMember();
    await renderWithProviders(<PaymentReturnScreen />);

    expect(await screen.findByTestId('payment-return-failed')).toBeTruthy();
    expect(screen.getByText(D.noSubscriptionHint)).toBeTruthy();
    expect(screen.queryByTestId('payment-return-resume-btn')).toBeNull();
  });
});

describe('PaymentReturnScreen — cancel purchase', () => {
  it('rolls the pending subscription back as a member regret, then leaves', async () => {
    const staged = stageReturn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithProviders(<PaymentReturnScreen />);

    await user.press(
      await screen.findByTestId('payment-return-cancel-purchase-btn'),
    );

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        CP.confirmTitle,
        expect.any(String),
        expect.any(Array),
      ),
    );
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    expect(confirm).toBeDefined();

    await act(async () => {
      await confirm!.onPress?.();
    });

    // `intent` + `source` are what let the server hide the row from the
    // member's own lists while still stamping `abandoned_checkout`, so a
    // late webhook can revive it.
    await waitFor(() => expect(staged.cancels).toHaveLength(1));
    expect(staged.cancels[0]).toEqual({
      id: SUB_ID,
      intent: 'regret',
      source: 'return_page',
    });
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/shop'),
    );
    alertSpy.mockRestore();
  });

  it('does nothing when the member keeps the checkout', async () => {
    const staged = stageReturn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    await renderWithProviders(<PaymentReturnScreen />);

    await user.press(
      await screen.findByTestId('payment-return-cancel-purchase-btn'),
    );
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    expect(staged.cancels).toHaveLength(0);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
