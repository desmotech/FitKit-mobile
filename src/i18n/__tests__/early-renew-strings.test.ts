/**
 * earlyRenewErrorMessage (FIT-282 follow-up) — pins the structured-code →
 * localized-copy mapping the early-renewal confirm flow uses: every code
 * `renewEarly` can throw maps to its table copy, unknown codes fall back to
 * the generic line. Mirrors payment-error-strings.test.ts.
 */
import { earlyRenewStringsFor } from '@/i18n/early-renew-strings';
import { earlyRenewErrorMessage } from '@/i18n/use-early-renew-strings';

const S = earlyRenewStringsFor('he');

describe('earlyRenewErrorMessage', () => {
  it.each([
    ['no_active_payment_method', S.errNoActivePaymentMethod],
    ['provider_charge_unverified', S.errProviderChargeUnverified],
    ['early_renew_not_active', S.errNotActive],
    ['early_renew_pending_change', S.errPendingChange],
    ['early_renew_not_available', S.errNotAvailable],
    ['early_renew_charge_failed', S.errChargeFailed],
    ['early_renew_already_in_progress', S.errAlreadyInProgress],
  ] as const)('maps %s to its localized copy', (code, expected) => {
    expect(earlyRenewErrorMessage(S, code)).toBe(expected);
  });

  it('falls back to the generic line for an unknown/missing code', () => {
    expect(earlyRenewErrorMessage(S, undefined)).toBe(S.errGeneric);
    expect(earlyRenewErrorMessage(S, 'something_else')).toBe(S.errGeneric);
  });
});

describe('earlyRenewStringsFor', () => {
  it('falls back to Hebrew for an unknown locale', () => {
    expect(earlyRenewStringsFor('xx' as never)).toBe(
      earlyRenewStringsFor('he'),
    );
  });
});
