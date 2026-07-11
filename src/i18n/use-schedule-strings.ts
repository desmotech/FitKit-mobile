import { useMemo } from 'react';
import { type ScheduleStrings, scheduleStringsFor } from './schedule-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Returns the schedule / class-booking chrome strings for the member's
 *  UI locale. */
export function useScheduleStrings(): ScheduleStrings {
  const { lang } = useI18n();
  return useMemo(() => scheduleStringsFor(lang), [lang]);
}
