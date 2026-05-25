import { useMemo } from 'react';
import { type LogStrings, logStringsFor } from './log-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Returns the log-flow strings for the active locale. Cached per-lang
 * so referential equality is stable across renders — components can
 * destructure into useEffect deps without churning.
 */
export function useLogStrings(): LogStrings {
  const { lang } = useI18n();
  return useMemo(() => logStringsFor(lang), [lang]);
}
