import type {
  CreateSetResultInput,
  WorkoutResultResponse,
  WorkoutSetResultResponse,
} from '@fitkit/shared';
import { parseYmdLocal } from '@/lib/week';
import { useApiAction, useApiQuery, useApiSend } from './use-api-query';
import type { ApiEnvelope } from './use-feed-data';
import { queryKeys } from '@/lib/query-keys';

// ── Types (mirror what /assignments/my-week returns) ─────────────────

export interface WorkoutMovement {
  id: string;
  sortOrder: number;
  exercise: {
    id: string;
    name: string;
    category: string;
    kind?: string | null;
    description?: string | null;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    primaryMuscles?: string[];
    secondaryMuscles?: string[];
    equipment?: string[];
    movementPattern?: string | null;
    cues?: string[];
    slug?: string | null;
  };
  prescribedSets: number | null;
  prescribedReps: string | null;
  prescribedWeight: string | null;
  prescribedDistance: string | null;
  prescribedDuration: string | null;
  notes: string | null;
  label?: string | null;
  supersetGroup?: string | null;
  prescription?: Record<string, unknown> | null;
}

export interface WorkoutSection {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  sortOrder: number;
  movements: WorkoutMovement[];
  shape?: string | null;
  config?: Record<string, unknown> | null;
}

export interface WorkoutLite {
  id: string;
  title: string | null;
  displayName: string;
  description: string | null;
  scoring: string;
  mode: string;
  timeCap: number | null;
  sortOrder: number;
  /**
   * Lazy-fork back-pointer. For a per-assignment snapshot this is the
   * canonical library workout id; null when the row IS the library workout.
   * Use `forkedFromId ?? id` as the library id to scope history across days.
   */
  forkedFromId?: string | null;
  sections?: WorkoutSection[];
}

export interface AssignmentProgramLite {
  id: string;
  name: string;
  deliveryMode?: string | null;
}

export type AssignmentKind = 'workout' | 'rest' | 'note';

export interface AssignmentDay {
  id: string;
  date: string; // YYYY-MM-DD
  published: boolean;
  status?: 'assigned' | 'completed' | 'skipped';
  /**
   * Per-cell kind. Defaults to `'workout'` for back-compat with older
   * payloads. `'rest'` is a rest-day marker with no workout body.
   * `'note'` carries a free-text coach note in `note` and has no workout.
   */
  kind?: AssignmentKind | null;
  /** Free-text coach note; only set when `kind === 'note'`. */
  note?: string | null;
  /**
   * Backing workout. Required when `kind === 'workout'`. Missing on
   * `'rest'` and `'note'` cells — call sites must guard before reading
   * `displayName`, `sections`, etc.
   */
  workout?: WorkoutLite | null;
  coachPreNote?: string | null;
  coachPostNote?: string | null;
  // Server-side completion state if available; client also derives from result presence.
  completedAt?: string | null;
  /** Unread in-workout chat messages for this assignment (toFullResponse). */
  unreadCount?: number;
  /** Server returns this on /assignments/my-week (toFullResponse). Null = personal/direct assignment. */
  program?: AssignmentProgramLite | null;
}

// ── Hook: my program enrollments ─────────────────────────────────────

/**
 * Active program enrollments for the current member, used to drive the
 * dynamic Program tabs on the Whiteboard. Mirrors the web's
 * `useMyDeliveryModes` (apps/web/src/hooks/use-org-programs.ts) — same
 * endpoint, same cache shape.
 *
 * The server caches with `private, max-age=60, stale-while-revalidate=300`,
 * so we lean on React Query defaults rather than aggressive refetching.
 */
export interface ProgramEnrollment {
  id: string;
  programId: string;
  program: AssignmentProgramLite;
}

export function useMyProgramEnrollments(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/programs/my-enrollments` : '';
  return useApiQuery<ApiEnvelope<ProgramEnrollment[]>>({
    path,
    queryKey: orgId
      ? queryKeys.programs.myEnrollments(orgId)
      : ['/programs/my-enrollments', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

// ── Hook: all programs the org offers ────────────────────────────────

/**
 * `deliveryMode` value for class-scheduled programs. A schedule program
 * has no per-member enrollment — if the org runs one it's open to every
 * member — so its presence can't be read off `useMyProgramEnrollments`
 * and must come from the org-wide program list.
 */
export const SCHEDULE_DELIVERY_MODE = 'schedule';

/**
 * Every program the org offers, regardless of the current member's
 * enrollments. Used to gate the Schedule tab on whether the org runs a
 * schedule-delivery program (see {@link SCHEDULE_DELIVERY_MODE}).
 */
export function useOrgPrograms(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/programs` : '';
  return useApiQuery<ApiEnvelope<AssignmentProgramLite[]>>({
    path,
    queryKey: orgId
      ? queryKeys.programs.all(orgId)
      : ['/programs', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

/** Whether `programs` contains a class-scheduled program. */
export function hasScheduleProgram(
  programs: AssignmentProgramLite[] | undefined,
): boolean {
  return (programs ?? []).some(
    (p) => p.deliveryMode === SCHEDULE_DELIVERY_MODE,
  );
}

// ── Hook: this week's assignments ────────────────────────────────────

/**
 * Returns assignments for the calendar week that contains `weekStart`
 * (Monday in YYYY-MM-DD). Skips the request until orgId resolves.
 */
export function useMyWeekAssignments(
  orgId: string | undefined | null,
  weekStart: string | undefined,
) {
  const path =
    orgId && weekStart
      ? `/organizations/${orgId}/assignments/my-week?weekStart=${weekStart}`
      : '';
  return useApiQuery<ApiEnvelope<AssignmentDay[]>>({
    path,
    queryKey: orgId && weekStart
      ? queryKeys.assignments.myWeek(orgId, weekStart)
      : ['/assignments/my-week', 'noop'],
    queryOptions: { enabled: !!orgId && !!weekStart },
  });
}

// ── Hook: single assignment by id ────────────────────────────────────

/**
 * Direct fetch of one assignment by id with the full workout payload.
 * Used by the workout detail screen so it isn't bound to the current
 * week's data — necessary for cross-week, history, notification, and
 * deep-link navigation.
 *
 * The shape matches a single AssignmentDay (same `toFullResponse` on
 * the server) so the detail screen renders identically whether the
 * row came from the week query cache or this direct fetch.
 */
export function useWorkoutAssignment(
  orgId: string | undefined | null,
  assignmentId: string | undefined | null,
) {
  const path =
    orgId && assignmentId
      ? `/organizations/${orgId}/assignments/${assignmentId}`
      : '';
  return useApiQuery<ApiEnvelope<AssignmentDay>>({
    path,
    queryKey:
      orgId && assignmentId
        ? queryKeys.assignments.byId(orgId, assignmentId)
        : ['/assignments/:id', 'noop'],
    queryOptions: { enabled: !!orgId && !!assignmentId },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

// Pure week/date helpers live in @/lib/week; re-exported here so the many
// existing `from '@/hooks/use-workouts'` importers keep working.
export {
  WEEK_ORDER_SUNDAY,
  WEEK_ORDER_MONDAY,
  type DayKey,
  getWeekStartDay,
  getWeekOrder,
  weekStartFor,
  shiftWeek,
} from '@/lib/week';

// ── Hook: latest result for a workout (for "Last:" hint) ────────────

/** Canonical set shape from the API (weightKg / weightDisplayUnit, not the
 *  old weight/weightUnit the mobile used to assume). */
export type SetResultLite = WorkoutSetResultResponse;

export interface LatestResult {
  scoreValue?: string;
  scoreUnit?: string;
  rx?: boolean;
  scaled?: boolean;
  performedAt?: string;
  setResults?: WorkoutSetResultResponse[];
}

export function useLatestResult(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  const path =
    orgId && workoutId
      ? `/organizations/${orgId}/workouts/${workoutId}/results/me/latest`
      : '';
  return useApiQuery<ApiEnvelope<LatestResult | null>>({
    path,
    queryKey:
      orgId && workoutId
        ? queryKeys.results.latestForWorkout(orgId, workoutId)
        : ['/results/me/latest', 'noop'],
    queryOptions: { enabled: !!orgId && !!workoutId },
  });
}

// ── Hook: my results for the workout (for History list + chart) ─────

/**
 * Result shapes reuse the canonical `@fitkit/shared` schemas so the mobile and
 * API never drift. `WorkoutResult` is the base response plus the optional
 * `setResults` the library-scoped history endpoint adds (toResponseWithSets).
 */
export type WorkoutResultSet = WorkoutSetResultResponse;

export type WorkoutResult = WorkoutResultResponse & {
  setResults?: WorkoutSetResultResponse[];
};

export function useMyResults(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  const path = orgId ? `/organizations/${orgId}/results/me` : '';
  return useApiQuery<ApiEnvelope<WorkoutResult[]>>({
    path,
    queryKey: orgId
      ? queryKeys.results.mine(orgId)
      : ['/results/me', 'noop'],
    queryOptions: { enabled: !!orgId && !!workoutId },
  });
}

/**
 * Library-scoped repeat history for a single workout — every completion of the
 * canonical workout across weeks/assignments (server resolves forkedFromId).
 * Use this for the "my history" trend on the workout view; it's correct
 * regardless of which day's snapshot the athlete logged against (unlike
 * filtering `/results/me` by the snapshot-aliased `workoutId`).
 */
export function useWorkoutHistory(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  const path =
    orgId && workoutId
      ? `/organizations/${orgId}/workouts/${workoutId}/results`
      : '';
  return useApiQuery<ApiEnvelope<WorkoutResult[]>>({
    path,
    queryKey:
      orgId && workoutId
        ? queryKeys.results.workoutHistory(orgId, workoutId)
        : ['/workouts/results', 'noop'],
    queryOptions: { enabled: !!orgId && !!workoutId },
  });
}

// ── Hooks: edit / delete a logged result ─────────────────────────────

export interface UpdateResultInput {
  scoreValue?: string;
  scoreUnit?: string;
  rx?: boolean;
  scaled?: boolean;
  notes?: string;
  performedAt?: string;
}

/** PATCH a logged result. Edits the top-level fields (score / Rx-scaled /
 *  notes / date); per-set editing is not yet supported server-side. */
export function useUpdateResult(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
  resultId: string | undefined | null,
) {
  return useApiSend<ApiEnvelope<WorkoutResult>, UpdateResultInput>({
    path:
      orgId && workoutId && resultId
        ? `/organizations/${orgId}/workouts/${workoutId}/results/${resultId}`
        : '',
    method: 'PATCH',
  });
}

/** DELETE a logged result (soft-delete server-side). */
export function useDeleteResult(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
  resultId: string | undefined | null,
) {
  return useApiAction<ApiEnvelope<{ id: string }>>({
    path:
      orgId && workoutId && resultId
        ? `/organizations/${orgId}/workouts/${workoutId}/results/${resultId}`
        : '',
    method: 'DELETE',
  });
}

// ── Hook: log a result ───────────────────────────────────────────────

/** Per-set log input — the canonical shared contract (matches the API DTO). */
export type LogResultSetInput = CreateSetResultInput;

export interface LogResultInput {
  // Required by the server DTO (CreateWorkoutResultDto). The mobile always
  // sends it — '' when the workout has no score / only sets were logged.
  scoreValue: string;
  scoreUnit?: string;
  rx?: boolean;
  scaled?: boolean;
  notes?: string;
  performedAt: string; // ISO datetime
  // FIT-152: when set, the server forks the assignment's snapshot if
  // needed and anchors the result to the snapshot so per-day completions
  // keep their frozen prescription. Without it the result anchors to the
  // mutable library workout.
  assignmentId?: string;
  setResults?: CreateSetResultInput[];
}

export interface LogResultResponse {
  id: string;
  performedAt?: string;
  // Result logging makes no PR judgment — PRs are explicit (see useLogManualPR).
}

// ── Hook: per-exercise set history (trend) ───────────────────────────

export interface ExerciseHistorySet {
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  weightDisplayUnit: string | null;
  distanceM: number | null;
  distanceDisplayUnit: string | null;
  durationSeconds: number | null;
  rpe: number | null;
}

export interface ExerciseHistorySession {
  resultId: string;
  performedAt: string;
  workoutTitle: string | null;
  sets: ExerciseHistorySet[];
  topSetKg: number | null;
  totalVolumeKg: number | null;
}

export interface ExerciseHistory {
  exerciseId: string;
  exercise: { id: string; name: string };
  /** Current explicit PR for this exercise — overlay marker on the trend. */
  pr: { valueNumeric: number; unit: string; achievedAt: string } | null;
  sessions: ExerciseHistorySession[];
}

export function useExerciseHistory(
  orgId: string | undefined | null,
  exerciseId: string | undefined | null,
) {
  const path =
    orgId && exerciseId
      ? `/organizations/${orgId}/exercises/${exerciseId}/history/me`
      : '';
  return useApiQuery<ApiEnvelope<ExerciseHistory>>({
    path,
    queryKey:
      orgId && exerciseId
        ? queryKeys.exercises.historyMe(orgId, exerciseId)
        : ['/exercise-history', 'noop'],
    queryOptions: { enabled: !!orgId && !!exerciseId },
  });
}

export function useLogResult(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  return useApiSend<ApiEnvelope<LogResultResponse>, LogResultInput>({
    path:
      orgId && workoutId
        ? `/organizations/${orgId}/workouts/${workoutId}/results`
        : '',
    method: 'POST',
  });
}

// ── Hook: mark an assignment completed ───────────────────────────────

/**
 * Marks a workout assignment as completed. `POST .../complete` sets
 * status='completed' and stamps completedAt. Logging a result auto-completes
 * too (server-side), so the detail screen drives button state off
 * `status`/`completedAt`. Reversible via {@link useUncompleteAssignment}.
 */
export function useCompleteAssignment(
  orgId: string | undefined | null,
  assignmentId: string | undefined | null,
) {
  return useApiAction<ApiEnvelope<AssignmentDay>>({
    path:
      orgId && assignmentId
        ? `/organizations/${orgId}/assignments/${assignmentId}/complete`
        : '',
    method: 'POST',
  });
}

/**
 * Undoes a completion (mis-tap recovery). `POST .../uncomplete` resets
 * status→assigned and clears completedAt; logged results are left intact.
 */
export function useUncompleteAssignment(
  orgId: string | undefined | null,
  assignmentId: string | undefined | null,
) {
  return useApiAction<ApiEnvelope<AssignmentDay>>({
    path:
      orgId && assignmentId
        ? `/organizations/${orgId}/assignments/${assignmentId}/uncomplete`
        : '',
    method: 'POST',
  });
}

/** Derives a coarse state label for a day card. */
export type AssignmentState = 'today' | 'done' | 'missed' | 'upcoming';

export function getAssignmentState(day: AssignmentDay, now = new Date()): AssignmentState {
  // Date-only strings must parse as local midnight — `new Date('YYYY-MM-DD')`
  // is UTC midnight, which shifts the day for UTC- timezones.
  const dayDate =
    day.date.length === 10 ? parseYmdLocal(day.date) : new Date(day.date);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  dayDate.setHours(0, 0, 0, 0);
  if (day.completedAt) return 'done';
  if (dayDate.getTime() === today.getTime()) return 'today';
  if (dayDate < today) return 'missed';
  return 'upcoming';
}
