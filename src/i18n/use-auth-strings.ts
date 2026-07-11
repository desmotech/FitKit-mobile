import { useMemo } from 'react';
import { type AuthStrings, authStringsFor } from './auth-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Returns the sign-in / MFA / password-reset chrome strings for the
 *  member's UI locale. */
export function useAuthStrings(): AuthStrings {
  const { lang } = useI18n();
  return useMemo(() => authStringsFor(lang), [lang]);
}
