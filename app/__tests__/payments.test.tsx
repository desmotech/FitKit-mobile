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
import { dictionaries } from '@fitkit/shared';
import PaymentsScreen from '../(tabs)/profile/payments';
import { paymentErrorStringsFor } from '@/i18n/payment-error-strings';
import { cancelPendingStringsFor } from '@/i18n/cancel-pending-strings';
import { withdrawScheduledStringsFor } from '@/i18n/withdraw-scheduled-strings';
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

// Same overlay convention as profile.test.tsx: the pinned @fitkit/shared
// package predates these dictionary keys, so `pick` resolves to undefined
// and the static table is what the screen actually renders today.
function pick(path: string): string | undefined {
  let node: unknown = dictionaries.he;
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
}
const CP = cancelPendingStringsFor('he');
const CPS = {
  cta: pick('subscriptions.cancelPendingAction') ?? CP.cta,
  confirmTitle: pick('subscriptions.cancelPendingDialog.title') ?? CP.confirmTitle,
  confirmDescription:
    pick('subscriptions.cancelPendingDialog.description') ?? CP.confirmDescription,
  keepAction: pick('subscriptions.cancelPendingDialog.keepAction') ?? CP.keepAction,
  confirmAction:
    pick('subscriptions.cancelPendingDialog.confirmAction') ?? CP.confirmAction,
};

// Same overlay convention as CPS above: the dictionary wins when the pinned
// package carries the key, the static table is the fallback.
const EXPIRED_BADGE = pick('members.paymentMethods.expiredBadge') ?? S.cardExpired;

const W = withdrawScheduledStringsFor('he');
const WS = {
  cta: pick('subscriptions.withdrawScheduledAction') ?? W.cta,
  confirmTitle: pick('subscriptions.withdrawScheduledDialog.title') ?? W.confirmTitle,
  confirmDescription:
    pick('subscriptions.withdrawScheduledDialog.description') ??
    W.confirmDescription,
  confirmAction:
    pick('subscriptions.withdrawScheduledDialog.confirmAction') ?? W.confirmAction,
};

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

  it('badges the card on file once it is past its expiry month', async () => {
    // The month boundary itself is pinned in payment-method.test.ts; here a
    // long-dead year keeps the screen test free of clock mocking.
    stagePayments({ methods: [{ ...CARD, expiryMonth: 1, expiryYear: 2020 }] });
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('card-expired-badge')).toBeTruthy();
    });
    expect(screen.getByText(EXPIRED_BADGE)).toBeTruthy();
    // The fix stays one tap away — the badge explains the button, it does
    // not replace it.
    expect(screen.getByTestId('update-card-btn')).toBeTruthy();
  });

  it('leaves a card that is still in date unbadged', async () => {
    // Rolling year, not a literal: a fixture that quietly ages into "expired"
    // would turn this assertion green for the wrong reason.
    stagePayments({
      methods: [{ ...CARD, expiryMonth: 12, expiryYear: new Date().getFullYear() + 2 }],
    });
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('update-card-btn')).toBeTruthy();
    });
    expect(screen.queryByTestId('card-expired-badge')).toBeNull();
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

  // ── Cancel a pending checkout (member self-serve) ─────────────
  // A member whose ONLY subscription is `pending` used to see no
  // subscription card at all on this screen (the active-sub filter
  // excluded `pending` outright) — a dead end. `pendingSub` only ever fills
  // that slot when there's nothing live to show (never hides an active sub
  // behind a newer pending retry).

  // The three specs below stage the LEGACY singular payload (an API build
  // that sends `memberAction` without `memberActions`). The live API now
  // always sends both actions — that payload is covered in its own describe
  // at the end of this file.
  it('shows a cancel-pending action when the only subscription is a cancellable pending checkout', async () => {
    const pending = subscriptionWithPlan({
      status: 'pending',
      memberAction: 'cancel_pending',
    } as never);
    stagePayments({ subs: [pending] });

    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-pending-btn')).toBeTruthy();
    });
  });

  it('cancels the pending checkout after confirming in the alert', async () => {
    const pending = subscriptionWithPlan({
      status: 'pending',
      memberAction: 'cancel_pending',
    } as never);
    stagePayments({ subs: [pending] });
    const cancelCalls: unknown[] = [];
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/subscriptions/my/${pending.id}/cancel-pending`),
        async () => {
          cancelCalls.push(true);
          return HttpResponse.json({ data: { ...pending, status: 'cancelled' } });
        },
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderWithProviders(<PaymentsScreen />);
    const btn = await screen.findByTestId('cancel-pending-btn');
    await userEvent.press(btn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        CPS.confirmTitle,
        CPS.confirmDescription.replace('{plan}', 'Gold Unlimited'),
        expect.any(Array),
      );
    });
    // The LAST call, not the first: this screen can fire an unrelated Alert
    // on mount (same reason the pre-existing no-card-renew test above reads
    // `.at(-1)` rather than `calls[0]`), so index 0 isn't reliably ours.
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    expect(confirm).toBeDefined();

    await act(async () => {
      await confirm!.onPress?.();
    });

    await waitFor(() => expect(cancelCalls).toHaveLength(1));
  });

  it('never shows the cancel-pending action when a live subscription already exists', async () => {
    const pastDue = subscriptionWithPlan({ status: 'past_due' } as never);
    stagePayments({ subs: [pastDue] });

    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Renew|חידוש|Продлить/i)).toBeTruthy();
    });
    expect(screen.queryByTestId('cancel-pending-btn')).toBeNull();
  });
});

/**
 * Presale / future-start memberships (`status: 'scheduled'`).
 *
 * This screen only ever selected `active | past_due | debt`, so a member who
 * bought into a club that has not opened yet saw NOTHING here — no status, no
 * way out. Worse, the only cancel path that did exist (cancel-at-period-end)
 * stamped a notice date the due-cancellations sweep never looked at, so the
 * row sat there holding its seat forever. Withdrawing costs nothing and has
 * to be one tap away.
 */
describe('PaymentsScreen — not-yet-started membership', () => {
  const scheduled = () =>
    subscriptionWithPlan({
      id: 'sub_presale',
      status: 'scheduled',
      memberAction: 'none',
      memberActions: ['withdraw_scheduled'],
    } as never);

  it('shows the membership and a free-of-charge way out', async () => {
    stagePayments({ subs: [scheduled()] });
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('withdraw-scheduled-btn')).toBeTruthy();
    });
    expect(screen.getByText(WS.cta)).toBeTruthy();
  });

  it('withdraws after confirming, releasing the seat', async () => {
    const sub = scheduled();
    stagePayments({ subs: [sub] });
    const calls: unknown[] = [];
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/subscriptions/my/${sub.id}/withdraw`),
        () => {
          calls.push(true);
          return HttpResponse.json({ data: { ...sub, status: 'cancelled' } });
        },
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderWithProviders(<PaymentsScreen />);
    await userEvent.press(
      await screen.findByTestId('withdraw-scheduled-btn'),
    );

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        WS.confirmTitle,
        WS.confirmDescription.replace('{plan}', 'Gold Unlimited'),
        expect.any(Array),
      );
    });
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    await act(async () => {
      await confirm!.onPress?.();
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    alertSpy.mockRestore();
  });

  it('never offers the notice-period cancel on one, which the API refuses', async () => {
    stagePayments({ subs: [scheduled()] });
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('withdraw-scheduled-btn')).toBeTruthy();
    });
    expect(screen.queryByText(/Renew|חידוש|Продлить/i)).toBeNull();
  });
});

/**
 * The other half of the pending-checkout decision on this screen: finishing
 * the payment. It used to be unreachable here — the card offered only the
 * rollback — and on the profile tab the equivalent CTA called `renew`, which
 * the API rejects on a pending row.
 */
describe('PaymentsScreen — finish an unfinished checkout', () => {
  const pending = () =>
    subscriptionWithPlan({
      id: 'sub_pending',
      status: 'pending',
      memberAction: 'cancel_pending',
      memberActions: ['complete_checkout', 'cancel_pending'],
    } as never);

  it('offers both finishing and rolling back on the payload the API always sends', async () => {
    stagePayments({ subs: [pending()] });
    await renderWithProviders(<PaymentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('complete-checkout-btn')).toBeTruthy();
    });
    expect(screen.getByTestId('cancel-pending-btn')).toBeTruthy();
  });

  it('resumes the SAME checkout rather than starting a new purchase', async () => {
    const sub = pending();
    stagePayments({ subs: [sub] });
    const calls: unknown[] = [];
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${sub.id}/resume-checkout`,
        ),
        async ({ request }) => {
          calls.push(await request.json());
          return HttpResponse.json({
            data: {
              subscription: sub,
              paymentPageUrl: 'https://pay.example/redo',
              resuming: true,
            },
          });
        },
      ),
    );

    await renderWithProviders(<PaymentsScreen />);
    await userEvent.press(await screen.findByTestId('complete-checkout-btn'));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ subscriptionId: sub.id });
  });

  it('sends the rollback as a member regret from the profile', async () => {
    const sub = pending();
    stagePayments({ subs: [sub] });
    const bodies: unknown[] = [];
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${sub.id}/cancel-pending`,
        ),
        async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ data: { ...sub, status: 'cancelled' } });
        },
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await renderWithProviders(<PaymentsScreen />);
    await userEvent.press(await screen.findByTestId('cancel-pending-btn'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    await act(async () => {
      await confirm!.onPress?.();
    });

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      id: sub.id,
      intent: 'regret',
      source: 'profile',
    });
    alertSpy.mockRestore();
  });
});
