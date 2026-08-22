/**
 * Early subscription renewal (FIT-282 follow-up, mobile mirror of web's
 * early-renew-dialog.tsx / early-renew.md).
 *
 * A member with an ACTIVE subscription who has used up this cycle's month
 * quota before the period naturally ends can pay now to open a fresh period
 * immediately (BoostApp parity, Erez), instead of waiting out days they
 * can't book with.
 */

/** Structured API error codes `renewEarly` can throw (mirrors web's
 *  early-renew-dialog KNOWN_CODES). */
export const EARLY_RENEW_ERROR_CODES = [
  'no_active_payment_method',
  'provider_charge_unverified',
  'early_renew_not_active',
  'early_renew_pending_change',
  'early_renew_not_available',
  'early_renew_charge_failed',
  'early_renew_already_in_progress',
] as const;
export type EarlyRenewErrorCode = (typeof EARLY_RENEW_ERROR_CODES)[number];

export function asEarlyRenewErrorCode(
  code: string | undefined,
): EarlyRenewErrorCode | null {
  return code &&
    (EARLY_RENEW_ERROR_CODES as readonly string[]).includes(code)
    ? (code as EarlyRenewErrorCode)
    : null;
}
