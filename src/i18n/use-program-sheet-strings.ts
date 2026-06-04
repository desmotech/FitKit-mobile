import { useMemo } from 'react';
import {
  type ProgramSheetStrings,
  programSheetStringsFor,
} from './program-sheet-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Returns the Program Sheet strings for the active locale. Cached per-lang
 * so referential equality is stable across renders — components can
 * destructure into useEffect deps without churning.
 */
export function useProgramSheetStrings(): ProgramSheetStrings {
  const { lang } = useI18n();
  return useMemo(() => programSheetStringsFor(lang), [lang]);
}
