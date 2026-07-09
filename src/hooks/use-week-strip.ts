/**
 * Shared week-strip state for the Schedule and Workouts tabs: the seven
 * local Date objects for the visible week, prev/next navigation with a
 * haptic tap, and the RTL-aware horizontal swipe gesture (in Hebrew the
 * future is on the leading/right edge, so swipe direction flips).
 *
 * Extracted from app/(tabs)/schedule/index.tsx and
 * app/(tabs)/workouts/index.tsx, which carried byte-identical copies.
 */
import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { parseYmdLocal, shiftWeek } from '@/lib/week';
import { useHaptics } from './use-haptics';

const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 400;

export function useWeekStrip(options: {
  weekStart: string;
  setWeekStart: Dispatch<SetStateAction<string>>;
  isRTL: boolean;
}) {
  const { weekStart, setWeekStart, isRTL } = options;
  const haptics = useHaptics();

  const weekDays = useMemo(() => {
    const start = parseYmdLocal(weekStart);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const goPrev = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, -1));
  };
  const goNext = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, 1));
  };

  const weekSwipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet';
      const goRight =
        e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY;
      const goLeft =
        e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY;
      if (!goRight && !goLeft) return;
      if (goRight) {
        if (isRTL) runOnJS(goNext)();
        else runOnJS(goPrev)();
      } else if (goLeft) {
        if (isRTL) runOnJS(goPrev)();
        else runOnJS(goNext)();
      }
    });

  return { weekDays, goPrev, goNext, weekSwipeGesture };
}
