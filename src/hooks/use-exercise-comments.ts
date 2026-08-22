/**
 * Per-movement exercise-comment thread (FIT-181).
 *
 * Distinct from useWorkoutComments which targets assignment-level chat.
 * This hook talks to /workouts/:workoutId/movements/:movementId/comments
 * — comments pinned to a single exercise within a workout.
 *
 * Comments here are NOT paginated server-side today (the backend returns
 * the whole thread in chronological order, eager-loading replies). Mobile
 * uses a single useQuery rather than infiniteQuery to mirror that.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import type {
  CreateExerciseCommentDto,
  ExerciseCommentDto,
} from '@taikan/shared';
import { analytics } from '@/lib/analytics';
import { useApi } from './use-api';
import { queryKeys } from '@/lib/query-keys';

export function useExerciseComments(
  orgId: string | undefined | null,
  workoutId: string | undefined | null,
  movementId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const qc = useQueryClient();

  const enabled =
    !!orgId &&
    !!workoutId &&
    !!movementId &&
    isLoaded &&
    isSignedIn === true;

  const queryKey = queryKeys.exercises.comments(orgId, workoutId, movementId);

  const query = useQuery<{ data: ExerciseCommentDto[] }>({
    queryKey,
    queryFn: () =>
      fetchWithAuth(
        `/organizations/${orgId}/workouts/${workoutId}/movements/${movementId}/comments`,
      ) as Promise<{ data: ExerciseCommentDto[] }>,
    enabled,
    staleTime: 30_000,
  });

  const sendComment = useMutation<
    { data: ExerciseCommentDto },
    Error,
    CreateExerciseCommentDto
  >({
    mutationFn: (input) =>
      fetchWithAuth(
        `/organizations/${orgId}/workouts/${workoutId}/movements/${movementId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      ) as Promise<{ data: ExerciseCommentDto }>,
    onSuccess: (result, input) => {
      analytics.track('member_exercise_comment_posted', {
        org_id: orgId,
        workout_id: workoutId,
        movement_id: movementId,
        has_attachment: (input.attachmentIds?.length ?? 0) > 0,
        platform: 'mobile',
      });
      qc.setQueryData<{ data: ExerciseCommentDto[] }>(queryKey, (old) => {
        if (!old) return { data: [result.data] };
        return { data: [...old.data, result.data] };
      });
    },
  });

  return {
    query,
    comments: query.data?.data ?? [],
    sendComment,
  };
}
