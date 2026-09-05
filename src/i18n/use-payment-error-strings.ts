import { useMemo } from 'react';
import { ApiError } from '@/hooks/use-api';
import {
  type PaymentErrorStrings,
  paymentErrorStringsFor,
} from './payment-error-strings';
import { reportUnmappedApiCode } from '@/lib/error-reporting';
import { useI18n } from '@/providers/i18n-provider';

/** Dictionary paths per field — dictionary wins when it has a string;
 *  the static table is the fallback (same pattern as use-profile-strings). */
const DICT_PATHS: Record<keyof PaymentErrorStrings, string> = {
  noActivePaymentMethod: 'payments.errorCodes.no_active_payment_method',
  renewalChargeFailed: 'payments.errorCodes.renewal_charge_failed',
  bookingBeyondSubscriptionEnd:
    'payments.errorCodes.booking_beyond_subscription_end',
  pendingActionConflict: 'payments.errorCodes.pending_action_conflict',
  membershipNotActive: 'payments.errorCodes.membership_not_active',
  outstandingBalance: 'payments.errorCodes.outstanding_balance',
  resumeFirst: 'payments.errorCodes.resume_first',
  planChangeChargeFailed: 'payments.errorCodes.plan_change_charge_failed',
  planChangeInProgress: 'payments.errorCodes.plan_change_in_progress',
  planChangeConflict: 'payments.errorCodes.plan_change_conflict',
  planChangeCurrencyMismatch:
    'payments.errorCodes.plan_change_currency_mismatch',
  providerChargeUnverified: 'payments.errorCodes.provider_charge_unverified',
  // No shared keys — see the field docs in payment-error-strings.ts. Pointed
  // at paths that do not exist so the static copy always wins; if they are
  // ever added upstream the dictionary takes over automatically.
  cardRegistrationFailed: 'payments.errorCodes.card_registration_failed',
  cancelUnsupportedPlanType:
    'payments.errorCodes.cancel_unsupported_plan_type',
  purchaseRefusedTitle: 'payments.errorCodes.purchase_refused_title',
  purchaseRefusedBody: 'payments.errorCodes.purchase_refused_body',
  renewFailed: 'payments.errorCodes.renew_failed',
  generic: 'payments.errorCodes.generic',
  // Staff-side key, but the copy is the card's, not the console's — one
  // word for a card past its expiry date, identical for either audience.
  cardExpired: 'members.paymentMethods.expiredBadge',
  updateCard: 'profile.paymentHistory.updateCard',
  addCard: 'profile.paymentHistory.addCard',
  cancel: 'common.cancel',
};

/** Walk a dot-path through the dictionary; only string leaves count. */
function pick(dict: unknown, path: string): string | undefined {
  let node: unknown = dict;
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
}

export function usePaymentErrorStrings(): PaymentErrorStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: PaymentErrorStrings = { ...paymentErrorStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}

const BY_CODE: Record<string, keyof PaymentErrorStrings> = {
  no_active_payment_method: 'noActivePaymentMethod',
  renewal_charge_failed: 'renewalChargeFailed',
  pending_action_conflict: 'pendingActionConflict',
  membership_not_active: 'membershipNotActive',
  outstanding_balance: 'outstandingBalance',
  resume_first: 'resumeFirst',
  plan_change_charge_failed: 'planChangeChargeFailed',
  plan_change_in_progress: 'planChangeInProgress',
  plan_change_conflict: 'planChangeConflict',
  plan_change_currency_mismatch: 'planChangeCurrencyMismatch',
  provider_charge_unverified: 'providerChargeUnverified',
  cancel_unsupported_plan_type: 'cancelUnsupportedPlanType',
};

/**
 * Map a thrown API error to localized copy.
 *
 * Resolution order: a mapped code wins; then the caller's `fallback`; then the
 * error's own message; then the generic line.
 *
 * `fallback` outranks the server message on purpose. The API localizes via
 * `X-Locale`, but what it returns is the STAFF-console phrasing — booking
 * refusals come back as "ההרשמה נכשלה" ("the registration failed"), which
 * reads as the member's fault when the usual cause is a plan or a limit. A
 * call site that knows its flow can say something accurate and kind instead.
 * Flows with no better copy to offer omit `fallback` and keep the server
 * message, which for codes with no dictionary entry is the only specific
 * thing we have.
 *
 * `booking_beyond_subscription_end` interpolates the `endsAt` the API ships
 * in the error body.
 */
export function paymentErrorMessage(
  strings: PaymentErrorStrings,
  err: unknown,
  lang: string,
  fallback?: string,
  /** Names the flow in the unmapped-code report. Omit to skip reporting. */
  feature?: string,
): string {
  const error = err instanceof ApiError ? err : undefined;
  if (error?.code === 'booking_beyond_subscription_end') {
    const endsAtRaw = error.details?.endsAt;
    const endsAt =
      typeof endsAtRaw === 'string'
        ? new Date(endsAtRaw).toLocaleDateString(lang, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '—';
    return strings.bookingBeyondSubscriptionEnd.replace('{endsAt}', endsAt);
  }
  const key = error?.code ? BY_CODE[error.code] : undefined;
  if (key) return strings[key];
  // A code with no mapping now yields generic copy, so without this the
  // refusal is invisible on both sides: `shouldReportError` drops 4xx on the
  // grounds that "the UI already renders it", which is exactly what stopped
  // being true. One warning per code, carrying the server's own wording.
  if (feature) reportUnmappedApiCode(err, { feature });
  if (fallback) return fallback;
  return err instanceof Error && err.message ? err.message : strings.generic;
}
