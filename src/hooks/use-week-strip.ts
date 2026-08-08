/**
 * Shared week-strip state for the Schedule and Workouts tabs: the seven
 * local Date objects for the visible week, the selected day, prev/next
 * navigation with a haptic tap, and two RTL-aware horizontal swipe gestures.
 *
 * Two swipe scopes, matched to what you're swiping *on*:
 *   • `weekSwipeGesture` — on the date rail (the week picker) → ±1 week.
 *   • `daySwipeGesture`  — on the day's content → ±1 day, rolling into the
 *     next/previous week when it runs off the end of the strip.
 *
 * Both flip direction in RTL: Hebrew lays the week out right-to-left, so the
 * future sits on the left and dragging rightward pulls it in.
 *
 * Extracted from app/(tabs)/schedule/index.tsx and
 * app/(tabs)/workouts/index.tsx, which carried byte-identical copies.
 */
import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { parseYmdLocal, shiftWeek, ymd } from '@/lib/week';
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

  // The day the rail highlights. Stored as the member's raw pick but read
  // back *derived*, so paging weeks can never strand the selection on a day
  // the strip no longer renders — which showed the day list's empty state
  // until a cell was tapped. Falls back to today when the new week contains
  // it, else the week's first day; paging back restores the original pick.
  const [pickedDate, setPickedDate] = useState<string>(() => ymd(new Date()));

  const selectedDate = useMemo(() => {
    const keys = weekDays.map(ymd);
    if (keys.includes(pickedDate)) return pickedDate;
    const today = ymd(new Date());
    return keys.includes(today) ? today : keys[0];
  }, [weekDays, pickedDate]);

  const goPrev = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, -1));
  };
  const goNext = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, 1));
  };

  /**
   * Step the selection one day. Rolling off either end of the strip carries
   * the week with it — `setWeekStart` and the new pick land in the same
   * render, so the derived selection resolves to the day we asked for rather
   * than the fallback.
   */
  const goDay = (delta: 1 | -1) => {
    const d = parseYmdLocal(selectedDate);
    d.setDate(d.getDate() + delta);
    const next = ymd(d);
    // One day at a time, so leaving the strip always means exactly one week.
    if (!weekDays.some((wd) => ymd(wd) === next)) {
      setWeekStart((w) => shiftWeek(w, delta));
    }
    setPickedDate(next);
    haptics.select();
  };
  const goPrevDay = () => goDay(-1);
  const goNextDay = () => goDay(1);

  /**
   * Horizontal fling → `onBack` / `onForward`, mirrored for RTL. Vertical
   * intent fails the gesture so the surrounding ScrollView keeps its scroll.
   */
  const swipeGesture = (onBack: () => void, onForward: () => void) =>
    Gesture.Pan()
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
          if (isRTL) runOnJS(onForward)();
          else runOnJS(onBack)();
        } else {
          if (isRTL) runOnJS(onBack)();
          else runOnJS(onForward)();
        }
      });

  const weekSwipeGesture = swipeGesture(goPrev, goNext);
  const daySwipeGesture = swipeGesture(goPrevDay, goNextDay);

  return {
    weekDays,
    selectedDate,
    setSelectedDate: setPickedDate,
    goPrev,
    goNext,
    goPrevDay,
    goNextDay,
    weekSwipeGesture,
    daySwipeGesture,
  };
}
