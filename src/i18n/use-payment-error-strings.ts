import { useMemo } from 'react';
import { ApiError } from '@/hooks/use-api';
import {
  type PaymentErrorStrings,
  paymentErrorStringsFor,
} from './payment-error-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Dictionary paths per field — dictionary wins when it has a string;
 *  the static table is the fallback (same pattern as use-profile-strings). */
const DICT_PATHS: Record<keyof PaymentErrorStrings, string> = {
  noActivePaymentMethod: 'payments.errorCodes.no_active_payment_method',
  renewalChargeFailed: 'payments.errorCodes.renewal_charge_failed',
  bookingBeyondSubscriptionEnd:
    'payments.errorCodes.booking_beyond_subscription_end',
  pendingActionConflict: 'payments.errorCodes.pending_action_conflict',
  generic: 'payments.errorCodes.generic',
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

/**
 * Map a thrown API error to localized copy. Codes without a mapping fall
 * back to the error's own message (the API localizes some via `X-Locale`),
 * then to the generic line. `booking_beyond_subscription_end` interpolates
 * the `endsAt` the API ships in the error body.
 */
export function paymentErrorMessage(
  strings: PaymentErrorStrings,
  err: unknown,
  lang: string,
): string {
  const error = err instanceof ApiError ? err : undefined;
  switch (error?.code) {
    case 'no_active_payment_method':
      return strings.noActivePaymentMethod;
    case 'renewal_charge_failed':
      return strings.renewalChargeFailed;
    case 'pending_action_conflict':
      return strings.pendingActionConflict;
    case 'booking_beyond_subscription_end': {
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
    default:
      return err instanceof Error && err.message ? err.message : strings.generic;
  }
}
