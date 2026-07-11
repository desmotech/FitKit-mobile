import { useMemo } from 'react';
import {
  type WhiteboardStrings,
  whiteboardStringsFor,
} from './whiteboard-strings';
import { useI18n } from '@/providers/i18n-provider';

/** Returns the whiteboard (workouts tab) chrome strings for the
 *  member's UI locale. */
export function useWhiteboardStrings(): WhiteboardStrings {
  const { lang } = useI18n();
  return useMemo(() => whiteboardStringsFor(lang), [lang]);
}
