import { useMemo } from 'react';
import {
  type EarlyRenewStrings,
  earlyRenewStringsFor,
} from './early-renew-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@fitkit/shared`), keyed by the
 * `EarlyRenewStrings` field they feed. Dictionary value wins when it is a
 * string; otherwise the static per-language table is the fallback. Same
 * pattern as ./use-plan-change-strings.ts.
 */
const DICT_PATHS: Record<keyof EarlyRenewStrings, string> = {
  prompt: 'subscriptions.renewEarly.prompt',
  cta: 'subscriptions.renewEarly.cta',
  description: 'subscriptions.renewEarly.description',
  confirmAction: 'subscriptions.renewEarly.confirmAction',
  renewing: 'subscriptions.renewEarly.renewing',
  success: 'subscriptions.renewEarly.success',
  errNoActivePaymentMethod: 'payments.errorCodes.no_active_payment_method',
  errProviderChargeUnverified: 'payments.errorCodes.provider_charge_unverified',
  errNotActive: 'payments.errorCodes.early_renew_not_active',
  errPendingChange: 'payments.errorCodes.early_renew_pending_change',
  errNotAvailable: 'payments.errorCodes.early_renew_not_available',
  errChargeFailed: 'payments.errorCodes.early_renew_charge_failed',
  errAlreadyInProgress: 'payments.errorCodes.early_renew_already_in_progress',
  errGeneric: 'payments.errorCodes.generic',
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

export function useEarlyRenewStrings(): EarlyRenewStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: EarlyRenewStrings = { ...earlyRenewStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}

/** Map a structured API error code to its localized message (fallback: the
 *  generic error). Mirrors web's early-renew-dialog error mapping. */
export function earlyRenewErrorMessage(
  strings: EarlyRenewStrings,
  code: string | undefined,
): string {
  switch (code) {
    case 'no_active_payment_method':
      return strings.errNoActivePaymentMethod;
    case 'provider_charge_unverified':
      return strings.errProviderChargeUnverified;
    case 'early_renew_not_active':
      return strings.errNotActive;
    case 'early_renew_pending_change':
      return strings.errPendingChange;
    case 'early_renew_not_available':
      return strings.errNotAvailable;
    case 'early_renew_charge_failed':
      return strings.errChargeFailed;
    case 'early_renew_already_in_progress':
      return strings.errAlreadyInProgress;
    default:
      return strings.errGeneric;
  }
}
