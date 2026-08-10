/**
 * The member's booking allowance on the membership card. Quotas are enforced
 * server-side but were invisible until they blocked a booking; now that
 * windows are anchored to the subscription, the reset date is personal
 * rather than "the 1st", so both numbers have to be on screen.
 */
import { screen } from '@testing-library/react-native';
import { QuotaBalance, type QuotaUsage } from '../quota-balance';
import { renderWithProviders } from '../../../../test/render';

function makeQuota(overrides: Partial<QuotaUsage> = {}): QuotaUsage {
  return {
    period: 'month',
    limit: 5,
    used: 2,
    remaining: 3,
    windowStartsAt: '2026-08-06T00:00:00.000Z',
    windowEndsAt: '2026-09-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('QuotaBalance', () => {
  it('renders nothing for an unlimited plan', async () => {
    await renderWithProviders(
      <QuotaBalance quotas={[]} isRTL={false} locale="en" />,
    );
    expect(screen.queryByTestId('quota-balance')).toBeNull();
  });

  it('shows how much of the allowance is used and when it resets', async () => {
    await renderWithProviders(
      <QuotaBalance quotas={[makeQuota()]} isRTL={false} locale="en" />,
    );

    expect(screen.getByTestId('quota-month')).toBeOnTheScreen();
    expect(screen.getByText(/2.*5/)).toBeOnTheScreen();
    // The window END is the "resets on" date a member asks about.
    expect(screen.getByText(/09\/05\/26/)).toBeOnTheScreen();
  });

  it('calls out an exhausted allowance instead of leaving it to the door', async () => {
    await renderWithProviders(
      <QuotaBalance
        quotas={[makeQuota({ used: 5, remaining: 0 })]}
        isRTL={false}
        locale="en"
      />,
    );

    // The app defaults to Hebrew, so this asserts the copy a member sees.
    expect(screen.getByText(/ניצלת את כל המכסה/)).toBeOnTheScreen();
  });

  it('renders every limited period the plan sets', async () => {
    await renderWithProviders(
      <QuotaBalance
        quotas={[
          makeQuota({ period: 'week', limit: 3, used: 1, remaining: 2 }),
          makeQuota({ period: 'month', limit: 10, used: 4, remaining: 6 }),
        ]}
        isRTL={false}
        locale="en"
      />,
    );

    expect(screen.getByTestId('quota-week')).toBeOnTheScreen();
    expect(screen.getByTestId('quota-month')).toBeOnTheScreen();
    expect(screen.queryByTestId('quota-day')).toBeNull();
  });
});
