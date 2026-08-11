import { useMemo } from 'react';
import { type QuotaStrings, quotaStringsFor } from './quota-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Booking-allowance and presale strings for the member's UI locale. */
export function useQuotaStrings(): QuotaStrings {
  const { lang } = useI18n();
  return useMemo(() => quotaStringsFor(lang), [lang]);
}
