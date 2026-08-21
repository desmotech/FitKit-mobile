import { useMemo } from 'react';
import {
  type CheckoutDecisionStrings,
  checkoutDecisionStringsFor,
} from './checkout-decision-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@fitkit/shared`), keyed by the
 * `CheckoutDecisionStrings` field they feed. Dictionary value wins when it is
 * a string; otherwise the static per-language table is the fallback. Same
 * pattern as ./use-cancel-pending-strings.ts. `resuming` / `resumeError` have
 * no dictionary path — they are mobile-only labels.
 */
const DICT_PATHS: Partial<Record<keyof CheckoutDecisionStrings, string>> = {
  failedTitle: 'shop.paymentReturn.failedTitle',
  failedDesc: 'shop.paymentReturn.failedDesc',
  cancelledHint: 'shop.paymentReturn.cancelledHint',
  resumeAction: 'shop.paymentReturn.resumeAction',
  cancelPurchaseAction: 'shop.paymentReturn.cancelPurchaseAction',
  noSubscriptionHint: 'shop.paymentReturn.noSubscriptionHint',
  managePaymentsAction: 'shop.paymentReturn.managePaymentsAction',
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

export function useCheckoutDecisionStrings(): CheckoutDecisionStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: CheckoutDecisionStrings = {
      ...checkoutDecisionStringsFor(lang),
    };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}
