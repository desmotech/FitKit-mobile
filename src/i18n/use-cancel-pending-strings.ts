import { useMemo } from 'react';
import {
  type CancelPendingStrings,
  cancelPendingStringsFor,
} from './cancel-pending-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@taikan/shared`), keyed by the
 * `CancelPendingStrings` field they feed. Dictionary value wins when it is a
 * string; otherwise the static per-language table is the fallback. Same
 * pattern as ./use-early-renew-strings.ts. `cancelling` has no dictionary
 * path — it's a mobile-only loading label, always from the static table.
 */
const DICT_PATHS: Partial<Record<keyof CancelPendingStrings, string>> = {
  cta: 'subscriptions.cancelPendingAction',
  confirmTitle: 'subscriptions.cancelPendingDialog.title',
  confirmDescription: 'subscriptions.cancelPendingDialog.description',
  keepAction: 'subscriptions.cancelPendingDialog.keepAction',
  confirmAction: 'subscriptions.cancelPendingDialog.confirmAction',
  success: 'subscriptions.cancelPendingDialog.success',
  error: 'subscriptions.cancelPendingDialog.error',
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

export function useCancelPendingStrings(): CancelPendingStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: CancelPendingStrings = { ...cancelPendingStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}
