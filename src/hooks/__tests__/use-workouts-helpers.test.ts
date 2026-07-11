/**
 * Pure helpers behind the week strip: which day card reads today / done /
 * missed / upcoming, and whether the org runs a class schedule at all
 * (gates the Schedule tab).
 */
import {
  type AssignmentDay,
  type AssignmentProgramLite,
  getAssignmentState,
  hasScheduleProgram,
} from '../use-workouts';

const day = (over: Partial<AssignmentDay> = {}): AssignmentDay => ({
  id: 'a1',
  date: '2026-07-10',
  published: true,
  ...over,
});

describe('day-card state — what badge the member sees', () => {
  // Friday 2026-07-10, mid-afternoon local time.
  const now = new Date(2026, 6, 10, 15, 0);

  it("marks today's workout as today", () => {
    expect(getAssignmentState(day({ date: '2026-07-10' }), now)).toBe('today');
  });

  it('marks yesterday’s untouched workout as missed', () => {
    expect(getAssignmentState(day({ date: '2026-07-09' }), now)).toBe('missed');
  });

  it('marks tomorrow’s workout as upcoming', () => {
    expect(getAssignmentState(day({ date: '2026-07-11' }), now)).toBe('upcoming');
  });

  it('a completed workout reads done, even if it was days ago', () => {
    expect(
      getAssignmentState(
        day({ date: '2026-07-06', completedAt: '2026-07-06T18:00:00.000Z' }),
        now,
      ),
    ).toBe('done');
  });

  it('completion wins over the date — done even for a future-dated card', () => {
    expect(
      getAssignmentState(
        day({ date: '2026-07-12', completedAt: '2026-07-10T08:00:00.000Z' }),
        now,
      ),
    ).toBe('done');
  });

  it("keeps today's card on today right after local midnight (no UTC drift)", () => {
    // 00:30 local on the 10th — naive UTC parsing would call this the 9th
    // east of Greenwich and flip today's workout to missed.
    const justPastMidnight = new Date(2026, 6, 10, 0, 30);
    expect(getAssignmentState(day({ date: '2026-07-10' }), justPastMidnight)).toBe(
      'today',
    );
  });

  it('handles full timestamps, not just date-only strings', () => {
    expect(
      getAssignmentState(day({ date: '2026-07-10T09:00:00' }), now),
    ).toBe('today');
  });
});

describe('Schedule tab gate — does the org run classes?', () => {
  const program = (
    over: Partial<AssignmentProgramLite> = {},
  ): AssignmentProgramLite => ({ id: 'p1', name: 'Program', ...over });

  it('shows the tab when the org offers a class-scheduled program', () => {
    expect(
      hasScheduleProgram([
        program({ deliveryMode: 'assignments' }),
        program({ id: 'p2', deliveryMode: 'schedule' }),
      ]),
    ).toBe(true);
  });

  it('hides the tab when no program is class-scheduled', () => {
    expect(
      hasScheduleProgram([
        program({ deliveryMode: 'assignments' }),
        program({ id: 'p2', deliveryMode: null }),
        program({ id: 'p3' }),
      ]),
    ).toBe(false);
  });

  it('hides the tab while the program list has not loaded', () => {
    expect(hasScheduleProgram(undefined)).toBe(false);
    expect(hasScheduleProgram([])).toBe(false);
  });
});
