import { useMemo } from 'react';
import {
  type CoursesStrings,
  coursesStringsFor,
} from './courses-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Returns the course library/player strings for the active locale. Cached
 * per-lang so referential equality is stable across renders.
 */
export function useCoursesStrings(): CoursesStrings {
  const { lang } = useI18n();
  return useMemo(() => coursesStringsFor(lang), [lang]);
}
