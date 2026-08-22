import { useMemo } from 'react';
import {
  type WithdrawScheduledStrings,
  withdrawScheduledStringsFor,
} from './withdraw-scheduled-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@taikan/shared`), keyed by the
 * `WithdrawScheduledStrings` field they feed. Dictionary value wins when it
 * is a string; otherwise the static per-language table is the fallback. Same
 * pattern as ./use-cancel-pending-strings.ts. `withdrawing` is a mobile-only
 * loading label with no dictionary counterpart.
 */
const DICT_PATHS: Partial<Record<keyof WithdrawScheduledStrings, string>> = {
  cta: 'subscriptions.withdrawScheduledAction',
  confirmTitle: 'subscriptions.withdrawScheduledDialog.title',
  confirmDescription: 'subscriptions.withdrawScheduledDialog.description',
  keepAction: 'subscriptions.withdrawScheduledDialog.keepAction',
  confirmAction: 'subscriptions.withdrawScheduledDialog.confirmAction',
  success: 'subscriptions.withdrawScheduledDialog.success',
  error: 'subscriptions.withdrawScheduledDialog.error',
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

export function useWithdrawScheduledStrings(): WithdrawScheduledStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: WithdrawScheduledStrings = {
      ...withdrawScheduledStringsFor(lang),
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
