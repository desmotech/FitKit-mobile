import { useMemo } from 'react';
import { type ProfileSupportStrings, profileStringsFor } from './profile-strings';
import { useI18n } from '@/providers/i18n-provider';

export function useProfileStrings(): ProfileSupportStrings {
  const { lang } = useI18n();
  return useMemo(() => profileStringsFor(lang), [lang]);
}
