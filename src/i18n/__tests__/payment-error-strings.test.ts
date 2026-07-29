/**
 * paymentErrorMessage (FIT-272) — pins the structured-code → localized-copy
 * mapping used by the renew buttons, the booking flow, and the cancel flow:
 * known codes render their table copy, `booking_beyond_subscription_end`
 * interpolates the API's `endsAt`, unknown codes fall back to the error's
 * own message, and non-Error input lands on the generic line.
 */
import { ApiError } from '@/hooks/use-api';
import { paymentErrorStringsFor } from '@/i18n/payment-error-strings';
import { paymentErrorMessage } from '@/i18n/use-payment-error-strings';

const S = paymentErrorStringsFor('he');

describe('paymentErrorMessage', () => {
  it.each([
    ['no_active_payment_method', S.noActivePaymentMethod],
    ['renewal_charge_failed', S.renewalChargeFailed],
    ['pending_action_conflict', S.pendingActionConflict],
  ] as const)('maps %s to its localized copy', (code, expected) => {
    const err = new ApiError('raw server text', 409, code);
    expect(paymentErrorMessage(S, err, 'he')).toBe(expected);
  });

  it('interpolates endsAt for booking_beyond_subscription_end', () => {
    const err = new ApiError('raw', 400, 'booking_beyond_subscription_end', {
      endsAt: '2026-08-01T00:00:00.000Z',
    });
    const msg = paymentErrorMessage(S, err, 'en');
    expect(msg).not.toContain('{endsAt}');
    expect(msg).toBe(
      S.bookingBeyondSubscriptionEnd.replace(
        '{endsAt}',
        new Date('2026-08-01T00:00:00.000Z').toLocaleDateString('en', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      ),
    );
  });

  it('renders a dash when endsAt is missing from the error body', () => {
    const err = new ApiError('raw', 400, 'booking_beyond_subscription_end');
    expect(paymentErrorMessage(S, err, 'en')).toBe(
      S.bookingBeyondSubscriptionEnd.replace('{endsAt}', '—'),
    );
  });

  it('falls back to the error message for unmapped codes', () => {
    const err = new ApiError('localized server text', 409, 'debt_clearance_required');
    expect(paymentErrorMessage(S, err, 'he')).toBe('localized server text');
  });

  it('falls back to generic copy for non-Error input', () => {
    expect(paymentErrorMessage(S, 'boom', 'he')).toBe(S.generic);
  });
});
