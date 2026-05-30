import { useMemo } from 'react';
import { type ProfileSupportStrings, profileStringsFor } from './profile-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Returns the mobile profile support-section strings for the member's UI
 * locale (gym vs. FitKit cards). See `profile-strings.ts`.
 */
export function useProfileStrings(): ProfileSupportStrings {
  const { lang } = useI18n();
  return useMemo(() => profileStringsFor(lang), [lang]);
}
