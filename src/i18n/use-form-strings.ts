import { useMemo } from 'react';
import { type FormStrings, formStringsFor } from './form-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Returns the forms-flow chrome strings for the member's UI locale.
 * Form labels + body text come from the API server-side, localized to
 * `form.locale` — those are NOT in this dictionary.
 */
export function useFormStrings(): FormStrings {
  const { lang } = useI18n();
  return useMemo(() => formStringsFor(lang), [lang]);
}
