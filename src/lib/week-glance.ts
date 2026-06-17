/**
 * Pure model for the Home "This week" module — a per-day status rail plus a
 * single consistency figure.
 *
 * Consistency = (workouts completed + classes attended) ÷ (workouts assigned +
 * classes booked), judged **only on what has come due** (day ≤ today). Future
 * days are 'planned', never misses, so early in the week the number isn't
 * artificially low. Exclusions keep it honest:
 *   - rest / note cells aren't commitments,
 *   - waitlisted classes were never a confirmed seat,
 *   - box-cancelled classes aren't the member's miss.
 * A *skipped* workout stays in the denominator (it counts as a miss).
 *
 * Inputs are structural subsets of `AssignmentDay` / `ClassSession` so this
 * stays decoupled from the hook layer and trivially testable.
 */

export type DayStatus =
  | 'done' // a workout was completed or a class attended
  | 'today' // today, with something still to do
  | 'planned' // a future commitment (upcoming)
  | 'missed' // a past commitment that wasn't done (includes skipped)
  | 'rest' // coach-marked rest day
  | 'empty'; // nothing scheduled

export interface GlanceAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  kind?: string | null; // 'workout' | 'rest' | 'note' — defaults to 'workout'
  status?: string | null; // 'assigned' | 'completed' | 'skipped'
  completedAt?: string | null;
}

export interface GlanceSession {
  id: string;
  startsAt: string; // ISO
  status?: string | null; // 'draft' | 'published' | 'cancelled'
  myBookingStatus?: string | null; // 'confirmed' | 'waitlisted' | 'attended'
  myCheckedInAt?: string | null;
}

export interface DayCell {
  date: string; // YYYY-MM-DD
  status: DayStatus;
  isToday: boolean;
  /** Day carries a booked/attended class — drives the secondary pip. */
  hasClass: boolean;
  /** Representative ids so a tap can open the right detail screen. */
  assignmentId: string | null;
  sessionId: string | null;
}

export interface WeekConsistency {
  done: number;
  committed: number;
  /** 0–100, or null when nothing has come due yet (no chip). */
  pct: number | null;
}

export interface WeekGlanceModel {
  days: DayCell[];
  consistency: WeekConsistency;
}

// ── Predicates ───────────────────────────────────────────────────────

/** `kind` defaults to 'workout' for back-compat with older payloads. */
const isWorkoutCell = (a: GlanceAssignment): boolean =>
  a.kind == null || a.kind === 'workout';
const isRestCell = (a: GlanceAssignment): boolean => a.kind === 'rest';
const isWorkoutDone = (a: GlanceAssignment): boolean =>
  a.status === 'completed' || a.completedAt != null;

/** A firm seat — confirmed or already attended (waitlist doesn't count).
 *  Exported as the single source of truth for "is this my booking" so the
 *  Home "Today" gate and this rail can't drift apart. */
export const isMyBooking = (s: GlanceSession): boolean =>
  s.myBookingStatus === 'confirmed' || s.myBookingStatus === 'attended';
const isAttended = (s: GlanceSession): boolean =>
  s.myBookingStatus === 'attended' || s.myCheckedInAt != null;
export const isCancelled = (s: GlanceSession): boolean =>
  s.status === 'cancelled';

// ── Date helpers (local calendar day, no UTC drift) ──────────────────

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, n: number): string {
  const [ys, ms, ds] = ymd.split('-');
  const y = Number.parseInt(ys ?? '', 10);
  const m = Number.parseInt(ms ?? '', 10);
  const d = Number.parseInt(ds ?? '', 10);
  return toLocalYmd(new Date(y, m - 1, d + n));
}

// ── Builder ──────────────────────────────────────────────────────────

export function buildWeekGlance(input: {
  weekStart: string; // YYYY-MM-DD (locale week start)
  todayYMD: string; // YYYY-MM-DD
  assignments: GlanceAssignment[];
  sessions: GlanceSession[];
}): WeekGlanceModel {
  const { weekStart, todayYMD, assignments, sessions } = input;

  const assignmentsByDay = new Map<string, GlanceAssignment[]>();
  for (const a of assignments) {
    const arr = assignmentsByDay.get(a.date) ?? [];
    arr.push(a);
    assignmentsByDay.set(a.date, arr);
  }
  // Only sessions I have a relationship with, bucketed by local calendar day.
  const bookingsByDay = new Map<string, GlanceSession[]>();
  for (const s of sessions) {
    if (isCancelled(s) || !isMyBooking(s)) continue;
    const day = toLocalYmd(new Date(s.startsAt));
    const arr = bookingsByDay.get(day) ?? [];
    arr.push(s);
    bookingsByDay.set(day, arr);
  }

  const days: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dayAssignments = assignmentsByDay.get(date) ?? [];
    const workouts = dayAssignments.filter(isWorkoutCell);
    const bookings = bookingsByDay.get(date) ?? [];

    const isToday = date === todayYMD;
    const isPast = date < todayYMD;
    const isFuture = date > todayYMD;
    const anyDone = workouts.some(isWorkoutDone) || bookings.some(isAttended);
    const hasCommitment = workouts.length > 0 || bookings.length > 0;

    let status: DayStatus;
    if (anyDone) status = 'done';
    else if (hasCommitment && isFuture) status = 'planned';
    else if (hasCommitment && isPast) status = 'missed';
    else if (hasCommitment && isToday) status = 'today';
    else if (dayAssignments.some(isRestCell)) status = 'rest';
    else status = 'empty';

    days.push({
      date,
      status,
      isToday,
      hasClass: bookings.length > 0,
      assignmentId: workouts[0]?.id ?? null,
      sessionId: bookings[0]?.id ?? null,
    });
  }

  // Consistency — item-level, only what's come due (day ≤ today).
  let done = 0;
  let committed = 0;
  for (const a of assignments) {
    if (!isWorkoutCell(a) || a.date > todayYMD) continue;
    committed++;
    if (isWorkoutDone(a)) done++;
  }
  for (const s of sessions) {
    if (isCancelled(s) || !isMyBooking(s)) continue;
    if (toLocalYmd(new Date(s.startsAt)) > todayYMD) continue;
    committed++;
    if (isAttended(s)) done++;
  }

  return {
    days,
    consistency: {
      done,
      committed,
      pct: committed > 0 ? Math.round((done / committed) * 100) : null,
    },
  };
}
