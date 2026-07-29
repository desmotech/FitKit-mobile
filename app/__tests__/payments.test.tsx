/**
 * Profile → Payments (FIT-272) — pins the member card + renew surfaces:
 * a failed renew now explains itself (C1's structured codes → localized
 * copy) and dead-ends into card registration when there's no card, and the
 * hosted-page card flow is reachable in the HEALTHY state ("Update card" on
 * the card panel; "Add card" when nothing is on file) — not just from the
 * debt banner.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import PaymentsScreen from '../(tabs)/profile/payments';
import { paymentErrorStringsFor } from '@/i18n/payment-error-strings';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

const S = paymentErrorStringsFor('he');

const CARD = {
  id: 'pm_test',
  cardBrand: 'Visa',
  cardSuffix: '4242',
  expiryMonth: 12,
  expiryYear: 2028,
  isActive: true,
};

function stagePayments({
  subs = [subscriptionWithPlan()],
  methods = [CARD],
}: { subs?: unknown[]; methods?: unknown[] } = {}) {
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: subs }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-methods/my`), () =>
      HttpResponse.json({ data: methods }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payments/my`), () =>
      HttpResponse.json({ data: [], total: 0, page: 1, limit: 20 }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: [] }),
    ),
  );
}

describe('PaymentsScreen', () => {
  it('shows "Update card" on the card panel in the healthy state', async () => {
    stagePayments();
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('update-card-btn')).toBeTruthy();
    });
    expect(screen.getByText(S.updateCard)).toBeTruthy();
  });

  it('offers "Add card" when no payment method is on file', async () => {
    stagePayments({ methods: [] });
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByText(S.addCard)).toBeTruthy();
    });
    expect(screen.queryByTestId('update-card-btn')).toBeNull();
  });

  it('maps a no-card renew failure to localized copy with an add-card action', async () => {
    const pastDue = subscriptionWithPlan({ status: 'past_due' } as never);
    stagePayments({ subs: [pastDue], methods: [] });
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/subscriptions/${pastDue.id}/renew`),
        () =>
          HttpResponse.json(
            {
              message: 'No active payment method',
              code: 'no_active_payment_method',
              statusCode: 409,
            },
            { status: 409 },
          ),
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    await renderWithProviders(<PaymentsScreen />);
    // The renew CTA renders for past_due subs; label comes from the
    // membership strings the screen already uses.
    const renewBtn = await screen.findByText(/Renew|חידוש|Продлить/i);
    await user.press(renewBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        '',
        S.noActivePaymentMethod,
        expect.arrayContaining([
          expect.objectContaining({ text: S.addCard }),
        ]),
      );
    });

    // The alert's add-card action opens the hosted registration flow.
    const registerCalls: unknown[] = [];
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/payment-methods/register`),
        async ({ request }) => {
          registerCalls.push(await request.json());
          return HttpResponse.json({ data: { paymentPageUrl: null } });
        },
      ),
    );
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
    const addCard = buttons.find((b) => b.text === S.addCard);
    await act(async () => {
      addCard?.onPress?.();
    });
    await waitFor(() => {
      expect(registerCalls).toHaveLength(1);
    });
  });

  it('shows the declined-card copy when the renewal charge fails', async () => {
    const pastDue = subscriptionWithPlan({ status: 'past_due' } as never);
    stagePayments({ subs: [pastDue] });
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/subscriptions/${pastDue.id}/renew`),
        () =>
          HttpResponse.json(
            {
              message: 'Charge failed',
              code: 'renewal_charge_failed',
              statusCode: 402,
            },
            { status: 402 },
          ),
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    await renderWithProviders(<PaymentsScreen />);
    const renewBtn = await screen.findByText(/Renew|חידוש|Продлить/i);
    await user.press(renewBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('', S.renewalChargeFailed);
    });
  });
});
