import { useMemo } from 'react';
import { type CommonStrings, commonStringsFor } from './common-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Cross-cutting failure bodies and a11y labels for the member's locale. */
export function useCommonStrings(): CommonStrings {
  const { lang } = useI18n();
  return useMemo(() => commonStringsFor(lang), [lang]);
}
