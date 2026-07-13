import { useCallback } from 'react';
import { useApiAction, useApiQuery, useApiSend } from './use-api-query';
import { useApi } from './use-api';
import type { ApiEnvelope } from './use-feed-data';
import { queryKeys } from '@/lib/query-keys';
import type {
  CourseEntitlement,
  CourseWorkoutDetail,
} from '@/types/courses';

/**
 * Buyer-side course hooks. Mirror the endpoints apps/web's course player
 * hits — all under `/me/courses`, which resolves everything via the Clerk
 * user and ignores org context entirely (entitlements follow the human,
 * not the gym). None of these take an orgId on purpose.
 */

// Exact message the API returns while a paid entitlement is still
// 'pending' (webhook hasn't confirmed the payment yet) — same
// message-matching pattern as the web player.
export const COURSE_PAYMENT_PENDING_MESSAGE =
  'Payment is still being processed';

// Exact message the API returns with 409 COURSE_MEETING_FULL.
export const COURSE_MEETING_FULL_MESSAGE = 'Meeting is at capacity';

/** The course library — every course the signed-in user owns, across orgs. */
export function useMyCourses() {
  return useApiQuery<ApiEnvelope<CourseEntitlement[]>>({
    path: '/me/courses',
    queryKey: queryKeys.courses.mine(),
  });
}

/** One entitlement with the full curriculum + sessions + materials (the
 *  player payload). Polls while the buyer's payment webhook is in flight so
 *  the player snaps in the moment the entitlement flips to active. */
export function useMyCourse(programId: string | undefined | null) {
  return useApiQuery<ApiEnvelope<CourseEntitlement>>({
    path: programId ? `/me/courses/${programId}` : '',
    queryKey: programId
      ? queryKeys.courses.byId(programId)
      : ['/me/courses', 'noop'],
    queryOptions: {
      enabled: !!programId,
      refetchInterval: (q) =>
        q.state.error?.message === COURSE_PAYMENT_PENDING_MESSAGE
          ? 3000
          : false,
    },
  });
}

/** Full workout structure for the player's program sheet. */
export function useCourseWorkout(
  programId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  return useApiQuery<ApiEnvelope<CourseWorkoutDetail>>({
    path:
      programId && workoutId
        ? `/me/courses/${programId}/workouts/${workoutId}`
        : '',
    queryKey:
      programId && workoutId
        ? queryKeys.courses.workout(programId, workoutId)
        : ['/me/courses/workout', 'noop'],
    queryOptions: { enabled: !!programId && !!workoutId },
  });
}

/** Sets the start date (default: today, server-side). */
export function useStartCourse(programId: string | undefined | null) {
  return useApiSend<ApiEnvelope<CourseEntitlement>, { startDate?: string }>({
    path: programId ? `/me/courses/${programId}/start` : '',
    method: 'POST',
  });
}

/** Restarts from today — DESTRUCTIVE server-side (clears all completions,
 *  bumps restartCount). Call sites must confirm with the member first. */
export function useRestartCourse(programId: string | undefined | null) {
  return useApiSend<ApiEnvelope<CourseEntitlement>, Record<string, never>>({
    path: programId ? `/me/courses/${programId}/restart` : '',
    method: 'POST',
  });
}

/** Response of the (un)complete endpoints — `completedAt` is the WHOLE
 *  course's completion stamp, set when this tick finished the last workout. */
export interface CourseCompletionResult {
  completedAt?: string | null;
}

/** Marks a workout done (idempotent server-side). `workoutId` is the
 *  LIBRARY workout id from `CourseDayWorkout.workoutId`. */
export function useCompleteCourseWorkout(
  programId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  return useApiAction<ApiEnvelope<CourseCompletionResult>>({
    path:
      programId && workoutId
        ? `/me/courses/${programId}/workouts/${workoutId}/complete`
        : '',
    method: 'POST',
  });
}

/** Undoes a completion (mis-tap recovery). */
export function useUncompleteCourseWorkout(
  programId: string | undefined | null,
  workoutId: string | undefined | null,
) {
  return useApiAction<ApiEnvelope<CourseCompletionResult>>({
    path:
      programId && workoutId
        ? `/me/courses/${programId}/workouts/${workoutId}/complete`
        : '',
    method: 'DELETE',
  });
}

/** Books a spot on a course meeting. A full meeting rejects with 409 and
 *  {@link COURSE_MEETING_FULL_MESSAGE}. */
export function useBookCourseSession(programId: string | undefined | null) {
  return useApiAction<ApiEnvelope<unknown>, string>({
    path: (sessionId) =>
      programId ? `/me/courses/${programId}/sessions/${sessionId}/rsvp` : '',
    method: 'POST',
  });
}

/** Cancels a meeting booking (frees the spot; rebooking reuses the row). */
export function useCancelCourseSession(programId: string | undefined | null) {
  return useApiAction<ApiEnvelope<unknown>, string>({
    path: (sessionId) =>
      programId ? `/me/courses/${programId}/sessions/${sessionId}/rsvp` : '',
    method: 'DELETE',
  });
}

/**
 * Fetches a short-lived presigned download URL for a file material.
 * Imperative (not a query) — the URL expires quickly, so it must be
 * fetched fresh on every tap and never cached.
 */
export function useCourseMaterialDownload(
  programId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  return useCallback(
    async (materialId: string): Promise<string> => {
      const res = (await fetchWithAuth(
        `/me/courses/${programId}/materials/${materialId}/download`,
      )) as ApiEnvelope<{ url: string }>;
      return res.data.url;
    },
    [fetchWithAuth, programId],
  );
}
