/**
 * The membership card's money CTA. It used to offer "Renew" for anything
 * `past_due` or `cancelled`, which let a member undo a gym cancellation and
 * resurrect the row a plan change had superseded (paying for two plans). The
 * button now follows `memberAction`, resolved server-side by the same
 * predicate the renew endpoint enforces.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { MembershipCard } from '../membership-card';
import { formatPrice } from '@/lib/format-price';
import { renderWithProviders } from '../../../../test/render';

const LABELS = {
  title: 'Membership',
  active: 'Active',
  expires: 'Expires {date}',
  manage: 'Manage plan',
  renew: 'Renew',
  renewing: 'Renewing…',
  completePayment: 'Complete payment',
  updateCard: 'Update card',
  endedByGym: 'This membership was ended by the gym',
  checkoutNotCompleted: 'Checkout not completed',
  checkoutNotCompletedNote:
    'This checkout was never completed, so no membership started.',
  withdrawnBeforeStartNote:
    'This membership was cancelled before it started, so nothing was charged.',
  presalePurchased:
    'Purchase confirmed. Your first charge is on {date}, the day we open.',
  presalePurchasedWithAmount:
    'Purchase confirmed. Your first charge of {amount} is on {date}, the day we open.',
  noFurtherCharges: 'No further payments will be charged.',
  scheduledCancelDescExternal:
    'You have full access until then. Changed your mind? Buy the plan again from the shop to stay a member.',
  externallyBilled:
    "Your subscription is billed by the gym's payment provider. You can still cancel here, and the gym stops the payments with the provider. To change your plan, contact the gym.",
};

const STATUS = {
  active: 'Active',
  past_due: 'Overdue',
  cancelled: 'Ended',
  paused: 'Frozen',
  debt: 'Balance due',
  pending: 'Awaiting payment',
  scheduled: 'Starts when we open',
};

function renderCard(sub: Record<string, unknown>) {
  return renderWithProviders(
    <MembershipCard
      sub={{ id: 's1', status: 'active', plan: { name: 'Monthly' }, ...sub } as never}
      isRTL={false}
      colors={{} as never}
      statusLabels={STATUS}
      labels={LABELS}
      isRenewing={false}
      onRenew={jest.fn()}
    />,
  );
}

describe('MembershipCard CTA', () => {
  it('offers Manage on a live membership', async () => {
    await renderCard({ status: 'active', memberAction: 'none' });
    expect(screen.getByText('Manage plan')).toBeOnTheScreen();
  });

  /**
   * The CTA used to share one row with the plan name, flex-1 against a pill
   * whose label the gym never sees: a real presale name came out as
   * "QA Notice · Pre…" while "Manage plan" took a third of the card. The
   * name owns its line now, two of them before it ellipsises, and the pill
   * is a full-width footer.
   */
  it('gives a long plan name two lines of its own, away from the CTA', async () => {
    await renderCard({
      status: 'scheduled',
      displayStatus: 'scheduled',
      memberActions: ['none'],
      plan: { name: 'QA Notice · Presale monthly' },
    });

    const name = screen.getByTestId('membership-plan-name');
    expect(name).toHaveTextContent('QA Notice · Presale monthly');
    expect(name.props.numberOfLines).toBe(2);

    // The pill is its own footer element, not a sibling competing for the
    // title's row: it stretches instead of hugging its label.
    const cta = screen.getByTestId('membership-cta');
    expect(cta).toBeOnTheScreen();
    expect(screen.getByText('Manage plan')).toBeOnTheScreen();
  });

  it('offers Renew when the member may renew', async () => {
    await renderCard({ status: 'past_due', memberAction: 'renew' });
    expect(screen.getByText('Renew')).toBeOnTheScreen();
    // The status chip uppercases its label.
    expect(screen.getByText('OVERDUE')).toBeOnTheScreen();
  });

  it('asks for a card in debt — clearing the balance is staff-only', async () => {
    await renderCard({ status: 'debt', memberAction: 'update_card' });
    expect(screen.getByText('Update card')).toBeOnTheScreen();
    expect(screen.queryByText('Renew')).toBeNull();
  });

  it('asks a pending subscription to finish checkout', async () => {
    // Legacy singular shape (an API build that predates `memberActions`).
    await renderCard({ status: 'pending', memberAction: 'complete_checkout' });
    expect(screen.getByText('Complete payment')).toBeOnTheScreen();
  });

  it('shows NO button and says why when the gym ended it', async () => {
    await renderCard({ status: 'cancelled', memberAction: 'none' });

    expect(screen.queryByTestId('membership-cta')).toBeNull();
    expect(screen.queryByText('Renew')).toBeNull();
    expect(
      screen.getByText('This membership was ended by the gym'),
    ).toBeOnTheScreen();
  });

  it('still offers Renew on a membership the member ended themselves', async () => {
    await renderCard({ status: 'cancelled', memberAction: 'renew' });
    expect(screen.getByText('Renew')).toBeOnTheScreen();
    expect(screen.queryByTestId('membership-ended-note')).toBeNull();
  });
});

/**
 * An abandoned checkout arrives as `status: 'cancelled'` with no member
 * action — byte-for-byte the shape of a gym cancellation. Only
 * `displayStatus` tells them apart, and getting it wrong tells a member the
 * gym ended a membership they never actually bought.
 */
describe('MembershipCard — abandoned checkout vs ended membership', () => {
  const abandoned = {
    status: 'cancelled',
    displayStatus: 'checkout_abandoned',
    memberAction: 'none',
  };

  it('does NOT blame the gym for a checkout the member never completed', async () => {
    await renderCard(abandoned);

    expect(
      screen.getByText('This checkout was never completed, so no membership started.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('This membership was ended by the gym'),
    ).toBeNull();
  });

  it('offers no money CTA on one', async () => {
    await renderCard(abandoned);
    expect(screen.queryByText('Renew')).toBeNull();
    expect(screen.queryByTestId('membership-cta')).toBeNull();
  });

  it('labels the chip from the static strings when the dictionary lacks the key', async () => {
    // Pre-publish state: `@taikan/shared` has no `checkout_abandoned` status
    // key yet, so STATUS here has no entry and the card must still not fall
    // through to "Ended".
    await renderCard(abandoned);
    expect(screen.getByText('CHECKOUT NOT COMPLETED')).toBeOnTheScreen();
    expect(screen.queryByText('ENDED')).toBeNull();
  });

  it('prefers the dictionary label once it ships', async () => {
    await renderWithProviders(
      <MembershipCard
        sub={{ id: 's1', plan: { name: 'Monthly' }, ...abandoned } as never}
        isRTL={false}
        colors={{} as never}
        statusLabels={{ ...STATUS, checkout_abandoned: 'Not completed' }}
        labels={LABELS}
        isRenewing={false}
        onRenew={jest.fn()}
      />,
    );
    expect(screen.getByText('NOT COMPLETED')).toBeOnTheScreen();
  });

  it('keeps blaming nobody but the gym when displayStatus is absent', async () => {
    // Older API build: no `displayStatus` at all. Behaviour must be exactly
    // what it was before this field existed.
    await renderCard({ status: 'cancelled', memberAction: 'none' });
    expect(
      screen.getByText('This membership was ended by the gym'),
    ).toBeOnTheScreen();
    expect(screen.getByText('ENDED')).toBeOnTheScreen();
  });
});

// FIT-282 follow-up (early renewal, BoostApp parity): a second, independent
// CTA from the main memberAction pill — the parent screen resolves
// eligibility (quota exhausted, flag on, no pending change), this card just
// renders what it's told.
describe('MembershipCard — early renewal CTA', () => {
  it('renders nothing extra when canRenewEarly is not set', async () => {
    await renderCard({ status: 'active', memberAction: 'none' });
    expect(screen.queryByTestId('renew-early-cta')).toBeNull();
  });

  it('shows the early-renew CTA when the parent says it is eligible', async () => {
    await renderWithProviders(
      <MembershipCard
        sub={{ id: 's1', status: 'active', plan: { name: 'Monthly' } } as never}
        isRTL={false}
        colors={{} as never}
        statusLabels={STATUS}
        labels={LABELS}
        isRenewing={false}
        onRenew={jest.fn()}
        canRenewEarly
        isRenewingEarly={false}
        onRenewEarly={jest.fn()}
      />,
    );
    expect(screen.getByTestId('renew-early-cta')).toBeOnTheScreen();
  });

  it('fires onRenewEarly when tapped', async () => {
    const onRenewEarly = jest.fn();
    await renderWithProviders(
      <MembershipCard
        sub={{ id: 's1', status: 'active', plan: { name: 'Monthly' } } as never}
        isRTL={false}
        colors={{} as never}
        statusLabels={STATUS}
        labels={LABELS}
        isRenewing={false}
        onRenew={jest.fn()}
        canRenewEarly
        isRenewingEarly={false}
        onRenewEarly={onRenewEarly}
      />,
    );
    fireEvent.press(screen.getByTestId('renew-early-cta'));
    expect(onRenewEarly).toHaveBeenCalledTimes(1);
  });
});


/**
 * FIT-287 presale. A subscription bought before the gym opened is
 * `scheduled`: card on file, nothing charged, access starting on opening day.
 * Every other branch of this card reads it as a membership that has already
 * begun — "Expires {date}" over a period that never started — so the two
 * facts a member wants (the purchase went through, the money comes out on the
 * opening date) have to be said outright.
 */
describe('MembershipCard — presale purchase', () => {
  const OPENS = '2026-09-01T00:00:00.000Z';
  const presale = {
    status: 'scheduled',
    displayStatus: 'scheduled',
    memberAction: 'none',
    nextChargeAt: OPENS,
    currentPeriodEnd: null,
  };

  it('names the first-charge date and the amount', async () => {
    await renderCard({
      ...presale,
      effectivePriceInCents: 36800,
      plan: { name: 'Founders', currency: 'ILS' },
    });

    // Formatted through the app's own helper rather than a literal: the ILS
    // pattern carries RTL marks whose exact placement is an ICU detail.
    const amount = formatPrice(36800, 'ILS', 'he');
    const date = new Date(OPENS).toLocaleDateString('he');
    expect(
      screen.getByText(
        `Purchase confirmed. Your first charge of ${amount} is on ${date}, the day we open.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('STARTS WHEN WE OPEN')).toBeOnTheScreen();
  });

  // An API build without `effectivePriceInCents` must still get the date out
  // rather than guessing an amount off the plan's list price.
  it('falls back to the date alone when the server sent no amount', async () => {
    await renderCard(presale);

    const date = new Date(OPENS).toLocaleDateString('he');
    expect(
      screen.getByText(`Purchase confirmed. Your first charge is on ${date}, the day we open.`),
    ).toBeOnTheScreen();
  });

  it('never says the membership expires — it has not started', async () => {
    await renderCard({ ...presale, currentPeriodEnd: '2026-10-01T00:00:00.000Z' });

    expect(screen.queryByText(/Expires/)).toBeNull();
  });

  it('says nothing of the sort on an ordinary active membership', async () => {
    await renderCard({ status: 'active', memberAction: 'none' });

    expect(screen.queryByTestId('membership-presale-note')).toBeNull();
  });
});

/**
 * A `pending` checkout offers two things at once — finish paying, or roll it
 * back — and the singular `memberAction` could only ever name one. The card
 * reads the plural `memberActions` where the server sends it, and the money
 * CTA no longer calls `onRenew` for a pending row: the renew endpoint 400s on
 * one, so "Complete payment" was a button that could only fail.
 */
describe('MembershipCard — unfinished checkout', () => {
  function renderPending(
    sub: Record<string, unknown>,
    handlers: Record<string, unknown> = {},
  ) {
    return renderWithProviders(
      <MembershipCard
        sub={
          {
            id: 's1',
            status: 'pending',
            plan: { name: 'Monthly' },
            ...sub,
          } as never
        }
        isRTL={false}
        colors={{} as never}
        statusLabels={STATUS}
        labels={LABELS}
        isRenewing={false}
        onRenew={jest.fn()}
        {...handlers}
      />,
    );
  }

  it('completes the checkout instead of calling renew, which the API refuses', async () => {
    const onCompleteCheckout = jest.fn();
    const onRenew = jest.fn();
    await renderPending(
      { memberActions: ['complete_checkout', 'cancel_pending'] },
      { onCompleteCheckout, onRenew },
    );

    fireEvent.press(screen.getByTestId('membership-cta'));
    expect(onCompleteCheckout).toHaveBeenCalledTimes(1);
    expect(onRenew).not.toHaveBeenCalled();
  });

  it('offers the rollback alongside it, not instead of it', async () => {
    const onCancelPending = jest.fn();
    await renderPending(
      { memberActions: ['complete_checkout', 'cancel_pending'] },
      { onCompleteCheckout: jest.fn(), onCancelPending },
    );

    expect(screen.getByText('Complete payment')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('membership-cancel-pending'));
    expect(onCancelPending).toHaveBeenCalledTimes(1);
  });

  it('shows both halves for the payload the API always sends now', async () => {
    // The per-org cancel-pending gate is gone: every pending row comes back
    // as memberAction 'cancel_pending' PLUS the full action list. Reading
    // only the singular would show the rollback and hide the way to pay.
    const onCompleteCheckout = jest.fn();
    const onCancelPending = jest.fn();
    await renderPending(
      {
        memberAction: 'cancel_pending',
        memberActions: ['complete_checkout', 'cancel_pending'],
      },
      { onCompleteCheckout, onCancelPending },
    );

    expect(screen.getByText('Complete payment')).toBeOnTheScreen();
    expect(screen.getByTestId('membership-cancel-pending')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('membership-cta'));
    expect(onCompleteCheckout).toHaveBeenCalledTimes(1);
  });

  it('keeps rollback as the primary CTA when it is the only action offered', async () => {
    // Older API deployment: singular field only, no action list.
    const onCancelPending = jest.fn();
    await renderPending(
      { memberAction: 'cancel_pending' },
      { onCancelPending },
    );

    fireEvent.press(screen.getByTestId('membership-cta'));
    expect(onCancelPending).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('membership-cancel-pending')).toBeNull();
  });

  it('still honours a legacy complete_checkout singular', async () => {
    const onCompleteCheckout = jest.fn();
    await renderPending(
      { memberAction: 'complete_checkout' },
      { onCompleteCheckout },
    );

    expect(screen.getByText('Complete payment')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('membership-cta'));
    expect(onCompleteCheckout).toHaveBeenCalledTimes(1);
  });
});

/**
 * A presale purchase released before opening day comes back as
 * `status: 'cancelled'` with no member action — the same raw shape as a gym
 * cancellation and an abandoned checkout. Only `displayStatus: 'withdrawn'`
 * separates them, and getting it wrong told a member who walked away from a
 * membership that never started (and never charged them) that the gym had
 * ended it.
 */
describe('MembershipCard — withdrawn before opening day', () => {
  const withdrawn = {
    status: 'cancelled',
    displayStatus: 'withdrawn',
    memberAction: 'none',
  };

  it('does NOT blame the gym for a membership cancelled before it started', async () => {
    await renderCard(withdrawn);

    expect(
      screen.getByText(
        'This membership was cancelled before it started, so nothing was charged.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText('This membership was ended by the gym'),
    ).toBeNull();
  });

  it('keeps the gym note for a membership somebody actually ended', async () => {
    await renderCard({
      status: 'cancelled',
      displayStatus: 'cancelled',
      memberAction: 'none',
    });
    expect(
      screen.getByText('This membership was ended by the gym'),
    ).toBeOnTheScreen();
  });

  it('does not blame the gym for a membership that simply ran its course', async () => {
    await renderCard({
      status: 'cancelled',
      displayStatus: 'expired',
      memberAction: 'none',
    });
    expect(
      screen.queryByText('This membership was ended by the gym'),
    ).toBeNull();
  });
});

/**
 * ADR-0017: a plan billed through the org's own payment provider. Taikan
 * only mirrors its status — it can cancel (stop asking the provider to
 * charge) but never restart a standing order it never controlled.
 * `resolveBillingState` reports `external` even after notice is given
 * (winning over `ending`), so the two notes are mutually exclusive with
 * whichever one `noFurtherCharges` would otherwise show.
 */
describe('MembershipCard — externally billed', () => {
  it('names the org as the biller before notice is given', async () => {
    await renderCard({
      status: 'active',
      memberAction: 'none',
      billingState: 'external',
    });
    expect(screen.getByTestId('external-billing-note')).toBeOnTheScreen();
    expect(screen.getByText(LABELS.externallyBilled)).toBeOnTheScreen();
  });

  it('says buying again, not resuming, once notice is given', async () => {
    await renderCard({
      status: 'active',
      memberAction: 'none',
      billingState: 'external',
      cancelAtPeriodEnd: true,
      cancellationEffectiveAt: '2026-09-30T00:00:00.000Z',
    });
    expect(
      screen.getByText(LABELS.scheduledCancelDescExternal),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('external-billing-note')).toBeNull();
    expect(screen.queryByText(LABELS.noFurtherCharges)).toBeNull();
  });

  it('keeps the plain no-further-charges note off-provider', async () => {
    await renderCard({
      status: 'active',
      memberAction: 'none',
      cancelAtPeriodEnd: true,
      cancellationEffectiveAt: '2026-09-30T00:00:00.000Z',
    });
    expect(screen.getByText(LABELS.noFurtherCharges)).toBeOnTheScreen();
    expect(screen.queryByTestId('external-billing-note')).toBeNull();
  });
});
