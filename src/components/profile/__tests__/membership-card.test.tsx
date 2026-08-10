/**
 * The membership card's money CTA. It used to offer "Renew" for anything
 * `past_due` or `cancelled`, which let a member undo a gym cancellation and
 * resurrect the row a plan change had superseded (paying for two plans). The
 * button now follows `memberAction`, resolved server-side by the same
 * predicate the renew endpoint enforces.
 */
import { screen } from '@testing-library/react-native';
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
