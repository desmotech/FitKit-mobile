import { useMemo } from 'react';
import {
  type CancelReasonStrings,
  cancelReasonStringsFor,
} from './cancel-reason-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@taikan/shared`), keyed by the
 * `CancelReasonStrings` field they feed. The dictionary value wins when it
 * is a string; otherwise the static per-language table is the fallback.
 * None of these exist in the pinned package yet, so the static table is what
 * renders today — same pattern as ./use-plan-change-strings.ts.
 */
const DICT_PATHS: Record<keyof CancelReasonStrings, string> = {
  categoryLabel: 'subscriptions.cancelDialog.reasonCodesLabel',
  relocation: 'subscriptions.cancelDialog.reasonCodes.relocation',
  financial: 'subscriptions.cancelDialog.reasonCodes.financial',
  dissatisfaction: 'subscriptions.cancelDialog.reasonCodes.dissatisfaction',
  health: 'subscriptions.cancelDialog.reasonCodes.health',
  schedule: 'subscriptions.cancelDialog.reasonCodes.schedule',
  noLongerNeeded: 'subscriptions.cancelDialog.reasonCodes.no_longer_needed',
  other: 'subscriptions.cancelDialog.reasonCodes.other',
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

export function useCancelReasonStrings(): CancelReasonStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: CancelReasonStrings = { ...cancelReasonStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}
