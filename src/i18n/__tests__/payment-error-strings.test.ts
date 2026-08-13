/**
 * paymentErrorMessage (FIT-272) — pins the structured-code → localized-copy
 * mapping used by the renew buttons, the booking flow, and the cancel flow:
 * known codes render their table copy, `booking_beyond_subscription_end`
 * interpolates the API's `endsAt`, unknown codes fall back to the error's
 * own message, and non-Error input lands on the generic line.
 *
 * A caller-supplied `fallback` outranks the server message: what the API
 * returns under `X-Locale` is the staff-console phrasing ("ההרשמה נכשלה"),
 * which blames the member for what is usually a plan or a limit.
 */
import * as Sentry from '@sentry/react-native';
import { ApiError } from '@/hooks/use-api';
import { paymentErrorStringsFor } from '@/i18n/payment-error-strings';
import { paymentErrorMessage } from '@/i18n/use-payment-error-strings';

const S = paymentErrorStringsFor('he');
const captureMessage = Sentry.captureMessage as jest.Mock;

beforeEach(() => captureMessage.mockClear());

describe('paymentErrorMessage', () => {
  it.each([
    ['no_active_payment_method', S.noActivePaymentMethod],
    ['renewal_charge_failed', S.renewalChargeFailed],
    ['pending_action_conflict', S.pendingActionConflict],
    ['membership_not_active', S.membershipNotActive],
    ['outstanding_balance', S.outstandingBalance],
    ['resume_first', S.resumeFirst],
    ['plan_change_charge_failed', S.planChangeChargeFailed],
    ['plan_change_in_progress', S.planChangeInProgress],
    ['plan_change_conflict', S.planChangeConflict],
    ['plan_change_currency_mismatch', S.planChangeCurrencyMismatch],
    ['provider_charge_unverified', S.providerChargeUnverified],
    ['plan_sold_out', S.planSoldOut],
  ] as const)('maps %s to its localized copy', (code, expected) => {
    const err = new ApiError('raw server text', 409, code);
    expect(paymentErrorMessage(S, err, 'he')).toBe(expected);
  });

  // FIT-289: the refusal names whichever cap bound. A group cap closes the
  // whole offer, so naming this plan would point the member at another
  // variant of the same closed offer.
  it('names the offer when a group cap produced the sold-out', () => {
    const err = new ApiError('raw', 409, 'plan_sold_out', { scope: 'group' });
    expect(paymentErrorMessage(S, err, 'he')).toBe(S.offerSoldOut);
  });

  it('names the plan when a plan cap produced the sold-out', () => {
    const err = new ApiError('raw', 409, 'plan_sold_out', { scope: 'plan' });
    expect(paymentErrorMessage(S, err, 'he')).toBe(S.planSoldOut);
  });

  // Every API build before group caps sends no `scope` at all — the only cap
  // that could have bound is the plan's own.
  it('treats a scopeless sold-out as the plan cap', () => {
    const err = new ApiError('raw', 409, 'plan_sold_out');
    expect(paymentErrorMessage(S, err, 'he')).toBe(S.planSoldOut);
  });

  it('keeps sold-out copy over a caller fallback, at either scope', () => {
    const plan = new ApiError('raw', 409, 'plan_sold_out');
    const group = new ApiError('raw', 409, 'plan_sold_out', {
      scope: 'group',
    });
    expect(paymentErrorMessage(S, plan, 'he', 'soft copy')).toBe(S.planSoldOut);
    expect(paymentErrorMessage(S, group, 'he', 'soft copy')).toBe(
      S.offerSoldOut,
    );
  });

  it('stays quiet for a sold-out at either scope — nothing is missing', () => {
    paymentErrorMessage(
      S,
      new ApiError('raw', 409, 'plan_sold_out'),
      'he',
      'soft copy',
      'plan-purchase',
    );
    paymentErrorMessage(
      S,
      new ApiError('raw', 409, 'plan_sold_out', { scope: 'group' }),
      'he',
      'soft copy',
      'plan-purchase',
    );

    expect(captureMessage).not.toHaveBeenCalled();
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

  it('prefers a caller fallback over the API message for an unmapped code', () => {
    // What the member would otherwise read, verbatim from the API.
    const err = new ApiError('ההרשמה נכשלה', 409, 'some_new_code');
    expect(paymentErrorMessage(S, err, 'he', 'soft copy')).toBe('soft copy');
  });

  it('still prefers mapped copy over a caller fallback', () => {
    const err = new ApiError('raw', 409, 'no_active_payment_method');
    expect(paymentErrorMessage(S, err, 'he', 'soft copy')).toBe(
      S.noActivePaymentMethod,
    );
  });

  it('uses the caller fallback when there is no code at all', () => {
    expect(paymentErrorMessage(S, new Error('boom'), 'he', 'soft copy')).toBe(
      'soft copy',
    );
  });

  it('reports an unmapped code so the missing copy is discoverable', () => {
    const err = new ApiError('ההרשמה נכשלה', 409, 'brand_new_code');
    paymentErrorMessage(S, err, 'he', 'soft copy', 'session-book');

    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage.mock.calls[0][0]).toContain('brand_new_code');
  });

  it('stays quiet for a code it does map — nothing is missing', () => {
    const err = new ApiError('raw', 409, 'no_active_payment_method');
    paymentErrorMessage(S, err, 'he', 'soft copy', 'session-book');

    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('does not report when the caller names no feature', () => {
    const err = new ApiError('raw', 409, 'brand_new_code');
    paymentErrorMessage(S, err, 'he');

    expect(captureMessage).not.toHaveBeenCalled();
  });
});