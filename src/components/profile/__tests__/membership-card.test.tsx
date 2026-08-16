/**
 * The membership card's money CTA. It used to offer "Renew" for anything
 * `past_due` or `cancelled`, which let a member undo a gym cancellation and
 * resurrect the row a plan change had superseded (paying for two plans). The
 * button now follows `memberAction`, resolved server-side by the same
 * predicate the renew endpoint enforces.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { MembershipCard } from '../membership-card';
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
};

const STATUS = {
  active: 'Active',
  past_due: 'Overdue',
  cancelled: 'Ended',
  paused: 'Frozen',
  debt: 'Balance due',
  pending: 'Awaiting payment',
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
    // Pre-publish state: `@fitkit/shared` has no `checkout_abandoned` status
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
