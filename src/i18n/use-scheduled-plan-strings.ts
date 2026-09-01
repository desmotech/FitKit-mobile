import { useMemo } from 'react';
import {
  type ScheduledPlanStrings,
  scheduledPlanStringsFor,
} from './scheduled-plan-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@taikan/shared`), keyed by the
 * `ScheduledPlanStrings` field they feed. Dictionary value wins when it is a
 * string; otherwise the static per-language table is the fallback. Same
 * pattern as ./use-withdraw-scheduled-strings.ts.
 */
const DICT_PATHS: Record<keyof ScheduledPlanStrings, string> = {
  startsOn: 'shop.planCard.startsOn',
  startsWhenOpen: 'profile.membership.status.scheduled',
  hint: 'shop.planCard.scheduledHint',
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

export function useScheduledPlanStrings(): ScheduledPlanStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: ScheduledPlanStrings = { ...scheduledPlanStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}
