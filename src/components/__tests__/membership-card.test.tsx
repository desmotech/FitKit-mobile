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
