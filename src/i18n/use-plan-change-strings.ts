import { useMemo } from 'react';
import {
  type PlanChangeStrings,
  planChangeStringsFor,
} from './plan-change-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@fitkit/shared`), keyed by the
 * `PlanChangeStrings` field they feed. The dictionary value wins when it is
 * a string; otherwise the static per-language table is the fallback. The
 * pinned shared release predates the FIT-254 keys, so today the tables are
 * what renders — once the dependency bumps, the dictionary takes over with
 * identical copy. Same pattern as ./use-profile-strings.ts.
 */
const DICT_PATHS: Record<keyof PlanChangeStrings, string> = {
  changePlanButton: 'profile.changePlan.changePlanButton',
  sheetTitle: 'profile.changePlan.sheetTitle',
  sheetDescription: 'profile.changePlan.sheetDescription',
  targetPlanLabel: 'profile.changePlan.targetPlanLabel',
  noPlansAvailable: 'profile.changePlan.noPlansAvailable',
  previewLoading: 'profile.changePlan.previewLoading',
  upgradeSummary: 'profile.changePlan.upgradeSummary',
  downgradeSummary: 'profile.changePlan.downgradeSummary',
  nextCharge: 'profile.changePlan.nextCharge',
  creditsAfter: 'profile.changePlan.creditsAfter',
  creditsUnlimited: 'profile.changePlan.creditsUnlimited',
  bookingsKeptTitle: 'profile.changePlan.bookingsKeptTitle',
  bookingsRevokedTitle: 'profile.changePlan.bookingsRevokedTitle',
  bookingsRevokedNote: 'profile.changePlan.bookingsRevokedNote',
  noBookingsAffected: 'profile.changePlan.noBookingsAffected',
  alreadyScheduledNotice: 'profile.changePlan.alreadyScheduledNotice',
  confirmAction: 'profile.changePlan.confirmAction',
  changing: 'profile.changePlan.changing',
  scheduledSuccess: 'profile.changePlan.scheduledSuccess',
  scheduledBanner: 'profile.changePlan.scheduledBanner',
  cancelChangeAction: 'profile.changePlan.cancelChangeAction',
  cancelChangeConfirmTitle: 'profile.changePlan.cancelChangeConfirmTitle',
  cancelChangeConfirmDescription:
    'profile.changePlan.cancelChangeConfirmDescription',
  cancelChangeSuccess: 'profile.changePlan.cancelChangeSuccess',
  cancelChangeError: 'profile.changePlan.cancelChangeError',
  switchToThisPlan: 'shop.planCard.switchToThisPlan',
  pickerTitle: 'shop.switchPicker.title',
  pickerDescription: 'shop.switchPicker.description',
  pickerCancel: 'shop.switchPicker.cancel',
  returnSuccessTitle: 'shop.paymentReturn.planChangeSuccessTitle',
  returnSuccessDesc: 'shop.paymentReturn.planChangeSuccessDesc',
  returnCancelledDesc: 'shop.paymentReturn.planChangeCancelledDesc',
  errOutstandingBalance: 'payments.errorCodes.outstanding_balance',
  errResumeFirst: 'payments.errorCodes.resume_first',
  errPendingActionConflict: 'payments.errorCodes.pending_action_conflict',
  errChargeFailed: 'payments.errorCodes.plan_change_charge_failed',
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

export function usePlanChangeStrings(): PlanChangeStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: PlanChangeStrings = { ...planChangeStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}

/** Map a structured API error code to its localized message (fallback:
 *  the generic error). Mirrors web's change-plan-sheet error mapping. */
export function planChangeErrorMessage(
  strings: PlanChangeStrings,
  code: string | undefined,
): string {
  switch (code) {
    case 'outstanding_balance':
      return strings.errOutstandingBalance;
    case 'resume_first':
      return strings.errResumeFirst;
    case 'pending_action_conflict':
      return strings.errPendingActionConflict;
    case 'plan_change_charge_failed':
      return strings.errChargeFailed;
    default:
      return strings.errGeneric;
  }
}
