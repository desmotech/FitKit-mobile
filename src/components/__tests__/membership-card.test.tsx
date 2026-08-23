/**
 * The membership card is the only subscription surface most members ever see.
 *
 * Its CTA label already switched to "Manage" when there was nothing to pay, but
 * the press still called `onRenew` — so the single button a healthy member
 * could reach said Manage and performed a renewal, and there was no route into
 * cancel / resume / change-plan at all. These tests pin the label to the
 * action, and pin the date shown once notice has been given.
 */
import { screen, userEvent } from '@testing-library/react-native';
import { MembershipCard } from '../profile/membership-card';
import { renderWithProviders } from '../../../test/render';
const LABELS = {
  title: 'Membership',
  active: 'Active',
  expires: 'Expires {date}',
  endsOn: 'Ends {date}',
  manage: 'Manage',
  renew: 'Renew',
  renewing: 'Renewing…',
  completePayment: 'Complete payment',
  updateCard: 'Update card',
  endedByGym: 'Your gym ended this membership.',
  checkoutNotCompleted: 'Checkout not completed',
  checkoutNotCompletedNote:
    'This checkout was never completed, so no membership started.',
  noFurtherCharges: 'No further payments will be charged.',
};

const STATUS_LABELS = { active: 'Active', cancelled: 'Cancelled' };

function sub(over: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'active',
    plan: { name: 'Monthly', type: 'subscription' },
    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    memberAction: 'none' as const,
    ...over,
  };
}

const BASE = {
  isRTL: false,
  colors: {} as never,
  statusLabels: STATUS_LABELS,
  labels: LABELS,
  isRenewing: false,
};

describe('MembershipCard', () => {
  it('opens management when the CTA says Manage — it does not renew', async () => {
    const onRenew = jest.fn();
    const onManage = jest.fn();
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub()}
        onRenew={onRenew}
        onManage={onManage}
      />,
    );

    await userEvent.press(screen.getByTestId('membership-cta'));

    expect(onManage).toHaveBeenCalledTimes(1);
    expect(onRenew).not.toHaveBeenCalled();
  });

  it('still renews when the server says there is something to pay', async () => {
    const onRenew = jest.fn();
    const onManage = jest.fn();
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub({ status: 'past_due', memberAction: 'renew' })}
        onRenew={onRenew}
        onManage={onManage}
      />,
    );

    await userEvent.press(screen.getByTestId('membership-cta'));

    expect(onRenew).toHaveBeenCalledTimes(1);
    expect(onManage).not.toHaveBeenCalled();
  });

  it('shows the next billing date while the membership is running', async () => {
    await renderWithProviders(
      <MembershipCard {...BASE} sub={sub()} onRenew={jest.fn()} />,
    );

    expect(
      screen.getByText(`Expires ${new Date('2026-09-01T00:00:00.000Z').toLocaleDateString()}`),
    ).toBeOnTheScreen();
  });

  it('shows the end date once notice has been given, not the billing date', async () => {
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub({
          cancelAtPeriodEnd: true,
          // A month past the billing boundary — the whole point of the notice
          // rule, and what the card used to get wrong.
          cancellationEffectiveAt: '2026-10-05T00:00:00.000Z',
        })}
        onRenew={jest.fn()}
      />,
    );

    expect(
      screen.getByText(`Ends ${new Date('2026-10-05T00:00:00.000Z').toLocaleDateString()}`),
    ).toBeOnTheScreen();
    expect(
      screen.queryByText(
        `Expires ${new Date('2026-09-01T00:00:00.000Z').toLocaleDateString()}`,
      ),
    ).toBeNull();
  });
});

/**
 * The card never counts the discounted cycles a plan still has to give: that
 * counter is a countdown to a price rise on the one subscription screen every
 * member sees, so it is not rendered for any billing state. What IS still said
 * is the note that runs the other way — once notice has been given, nothing
 * more will be charged.
 */
describe('MembershipCard — payment counters', () => {
  const ENDING = {
    introCyclesRemaining: 2,
    cancelAtPeriodEnd: true,
    cancellationEffectiveAt: '2026-10-05T00:00:00.000Z',
    billingState: 'ending' as const,
  };

  it('does not count intro payments on a healthy, billing membership', async () => {
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub({ introCyclesRemaining: 2, billingState: 'recurring' })}
        onRenew={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('intro-remaining')).toBeNull();
  });

  it('does not count payments on a membership that is ending', async () => {
    await renderWithProviders(
      <MembershipCard {...BASE} sub={sub(ENDING)} onRenew={jest.fn()} />,
    );

    expect(screen.queryByTestId('intro-remaining')).toBeNull();
  });

  it('still says that nothing more will be charged once notice is given', async () => {
    await renderWithProviders(
      <MembershipCard {...BASE} sub={sub(ENDING)} onRenew={jest.fn()} />,
    );

    expect(
      screen.getByText('No further payments will be charged.'),
    ).toBeOnTheScreen();
  });

  it('says nothing about payments on a membership that has already ended', async () => {
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub({
          status: 'cancelled',
          introCyclesRemaining: 2,
          billingState: 'stopped',
        })}
        onRenew={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('intro-remaining')).toBeNull();
    expect(screen.queryByTestId('no-further-charges')).toBeNull();
  });

  // ADR-0017: the gym's own provider debits the member and Taikan only
  // observes it — we cannot say what is coming next, so we say nothing.
  it('claims nothing about an externally billed subscription', async () => {
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub({ introCyclesRemaining: 2, billingState: 'external' })}
        onRenew={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('intro-remaining')).toBeNull();
    expect(screen.queryByTestId('no-further-charges')).toBeNull();
  });

  it('does not count them when the API sends no billingState at all', async () => {
    await renderWithProviders(
      <MembershipCard
        {...BASE}
        sub={sub({ introCyclesRemaining: 3 })}
        onRenew={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('intro-remaining')).toBeNull();
  });
});
