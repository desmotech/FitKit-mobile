import { useMemo } from 'react';
import { type HomeStrings, homeStringsFor } from './home-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Returns the home-dashboard chrome strings for the member's UI
 *  locale. */
export function useHomeStrings(): HomeStrings {
  const { lang } = useI18n();
  return useMemo(() => homeStringsFor(lang), [lang]);
}
