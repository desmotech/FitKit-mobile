/**
 * Week-strip selection — the day the Schedule / Program tabs render.
 *
 * Two behaviours are easy to break and invisible in a screenshot:
 *  1. Paging a week must never strand the selection on a day the strip no
 *     longer shows (that rendered an empty day until a cell was tapped).
 *  2. Stepping days by swipe must roll into the neighbouring week at the
 *     edges, carrying `weekStart` with it in the same render.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import { useWeekStrip } from '../use-week-strip';
import { getWeekStartDay, ymd, weekStartFor } from '@/lib/week';

const WEEK_STARTS_ON = getWeekStartDay('he'); // Sunday-anchored

/** Mirrors how the screens wire the hook: they own `weekStart`. */
function useHarness(today: Date) {
  const [weekStart, setWeekStart] = useState(() =>
    weekStartFor(today, WEEK_STARTS_ON),
  );
  const strip = useWeekStrip({ weekStart, setWeekStart, isRTL: false });
  return { weekStart, ...strip };
}

async function mount() {
  const today = new Date();
  const { result } = await renderHook(() => useHarness(today));
  return result;
}

describe('week-strip selection', () => {
  it('starts on today', async () => {
    const result = await mount();
    expect(result.current.selectedDate).toBe(ymd(new Date()));
  });

  it('lands on the first day of the week after paging forward, not a stale date', async () => {
    const result = await mount();
    const thisWeekPick = result.current.selectedDate;

    await act(async () => result.current.goNext());

    const keys = result.current.weekDays.map(ymd);
    // The selection must be a day the strip actually renders.
    expect(keys).toContain(result.current.selectedDate);
    expect(result.current.selectedDate).toBe(keys[0]);
    expect(result.current.selectedDate).not.toBe(thisWeekPick);
  });

  it('restores the original pick when paging back', async () => {
    const result = await mount();
    const original = result.current.selectedDate;

    await act(async () => result.current.goNext());
    await act(async () => result.current.goPrev());

    expect(result.current.selectedDate).toBe(original);
  });

  it('steps one day forward within the week', async () => {
    const result = await mount();
    const keys = result.current.weekDays.map(ymd);
    // Start from the first day so a single step stays inside the week.
    await act(async () => result.current.setSelectedDate(keys[0]));
    const weekStartBefore = result.current.weekStart;

    await act(async () => result.current.goNextDay());

    expect(result.current.selectedDate).toBe(keys[1]);
    expect(result.current.weekStart).toBe(weekStartBefore);
  });

  it('rolls into the next week when stepping past the last day', async () => {
    const result = await mount();
    const keys = result.current.weekDays.map(ymd);
    await act(async () => result.current.setSelectedDate(keys[6]));
    const weekStartBefore = result.current.weekStart;

    await act(async () => result.current.goNextDay());

    // Both the week and the pick move, so the selection is the new week's
    // first day rather than the clamp fallback.
    expect(result.current.weekStart).not.toBe(weekStartBefore);
    expect(result.current.weekDays.map(ymd)[0]).toBe(
      result.current.selectedDate,
    );
  });

  it('rolls into the previous week when stepping before the first day', async () => {
    const result = await mount();
    const keys = result.current.weekDays.map(ymd);
    await act(async () => result.current.setSelectedDate(keys[0]));
    const weekStartBefore = result.current.weekStart;

    await act(async () => result.current.goPrevDay());

    expect(result.current.weekStart).not.toBe(weekStartBefore);
    // Last day of the previous week.
    expect(result.current.weekDays.map(ymd)[6]).toBe(
      result.current.selectedDate,
    );
  });
});
