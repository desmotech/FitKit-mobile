import { useMemo } from 'react';
import { type OfflineStrings, offlineStringsFor } from './offline-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Returns the offline / sync copy for the member's UI locale. */
export function useOfflineStrings(): OfflineStrings {
  const { lang } = useI18n();
  return useMemo(() => offlineStringsFor(lang), [lang]);
}
