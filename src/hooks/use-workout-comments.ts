/**
 * Mobile port of `apps/web/src/hooks/messages/use-workout-comments.ts`.
 *
 * Workout-anchored comment thread shared with the web member drawer.
 * Storage rides on the unified `messages` table — the same endpoint and
 * payload shape works across surfaces. Mobile v1 ships without the
 * realtime socket subscription: the panel relies on TanStack's normal
 * cache + `refetchOnMount` to keep the thread fresh. When mobile picks
 * up the realtime layer, plug it in here to mirror web's `onMessage` +
 * `onReadReceipt` listeners.
 *
 * Endpoints:
 *   GET    /organizations/:orgId/workout-assignments/:id/comments?limit=&cursor=
 *   POST   /organizations/:orgId/workout-assignments/:id/comments
 *   PUT    /organizations/:orgId/workout-assignments/:id/comments/read
 *   DELETE /organizations/:orgId/messages/:messageId
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type {
  CreateWorkoutCommentInput,
  MessageResponse,
  MessagesListResponse,
} from '@fitkit/shared';
import { analytics } from '@/lib/analytics';
import { useApi } from './use-api';
import { queryKeys } from '@/lib/query-keys';

type CommentsPage = MessagesListResponse;
type InfiniteData = { pages: { data: CommentsPage }[]; pageParams: unknown[] };

export function useWorkoutComments(
  orgId: string | undefined | null,
  workoutAssignmentId: string | undefined | null,
  currentMembershipId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const enabled =
    !!orgId &&
    !!workoutAssignmentId &&
    !!currentMembershipId &&
    isLoaded &&
    isSignedIn === true;

  const queryKey = queryKeys.workoutComments.thread(orgId, workoutAssignmentId);

  const query = useInfiniteQuery<{ data: CommentsPage }>({
    queryKey,
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam as string}` : '';
      return fetchWithAuth(
        `/organizations/${orgId}/workout-assignments/${workoutAssignmentId}/comments?limit=50${cursor}`,
      ) as Promise<{ data: CommentsPage }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    enabled,
    staleTime: 30_000,
  });

  const sendComment = useMutation<
    { data: MessageResponse },
    Error,
    CreateWorkoutCommentInput
  >({
    mutationFn: (input) =>
      fetchWithAuth(
        `/organizations/${orgId}/workout-assignments/${workoutAssignmentId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      ) as Promise<{ data: MessageResponse }>,
    onSuccess: (result, input) => {
      analytics.track('member_workout_comment_posted', {
        org_id: orgId,
        workout_assignment_id: workoutAssignmentId,
        has_attachment: (input.attachmentIds?.length ?? 0) > 0,
        platform: 'mobile',
      });
      // Optimistically prepend the new message to the first page. Web has
      // an identical pattern — bypasses realtime echo since we own the
      // mutation result.
      queryClient.setQueryData<InfiniteData>(queryKey, (old) => {
        const newMsg = result.data;
        if (!old) {
          return {
            pages: [
              {
                data: {
                  messages: [newMsg],
                  nextCursor: null,
                  hasMore: false,
                },
              },
            ],
            pageParams: [null],
          };
        }
        const firstPage = old.pages[0];
        return {
          ...old,
          pages: [
            {
              data: {
                ...firstPage.data,
                messages: [newMsg, ...(firstPage?.data.messages ?? [])],
              },
            },
            ...old.pages.slice(1),
          ],
        };
      });
    },
  });

  const markRead = useMutation<
    { data: { markedCount: number } },
    Error,
    void,
    { prev: InfiniteData | undefined }
  >({
    mutationFn: () =>
      fetchWithAuth(
        `/organizations/${orgId}/workout-assignments/${workoutAssignmentId}/comments/read`,
        { method: 'PUT' },
      ) as Promise<{ data: { markedCount: number } }>,
    // Optimistically clear unread the instant the chat opens so the header
    // badge decreases immediately — independent of the server's markedCount
    // (which is 0 when a persisted cache is stale, leaving the badge stuck).
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<InfiniteData>(queryKey);
      if (currentMembershipId) {
        const readAtIso = new Date().toISOString();
        queryClient.setQueryData<InfiniteData>(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              data: {
                ...page.data,
                messages: page.data.messages.map((m) =>
                  m.recipientMembershipId === currentMembershipId && !m.readAt
                    ? { ...m, readAt: readAtIso }
                    : m,
                ),
              },
            })),
          };
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSuccess: () => {
      // Refresh sibling surfaces that derive unread state from these same
      // workout-tagged messages (Feed badges, Whiteboard day strip).
      // Match the mobile cache-key shapes — the previous predicate used
      // the web app's URL-string keys ('/workout-comments/…') and matched
      // nothing here, leaving day-strip unread badges stale.
      queryClient.invalidateQueries({
        queryKey: queryKeys.workoutComments.all(orgId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.badge.total(orgId ?? 'noop') });
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === '/organizations' &&
          q.queryKey[1] === orgId &&
          q.queryKey.includes('assignments'),
      });
    },
  });

  const deleteComment = useMutation<
    { data: { deleted: boolean } },
    Error,
    string
  >({
    mutationFn: (messageId) =>
      fetchWithAuth(`/organizations/${orgId}/messages/${messageId}`, {
        method: 'DELETE',
      }) as Promise<{ data: { deleted: boolean } }>,
    onSuccess: (_, messageId) => {
      queryClient.setQueryData<InfiniteData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            data: {
              ...page.data,
              messages: page.data.messages.filter((m) => m.id !== messageId),
            },
          })),
        };
      });
    },
  });

  // Memoized: an unstable array identity here cascades into the chat's
  // items memo on every render (incl. each composer keystroke).
  const pages = query.data?.pages;
  const allComments = useMemo(
    () => pages?.flatMap((p) => p.data.messages) ?? [],
    [pages],
  );

  const unreadCount = useMemo(
    () =>
      currentMembershipId
        ? allComments.reduce(
            (n, m) =>
              m.recipientMembershipId === currentMembershipId && !m.readAt
                ? n + 1
                : n,
            0,
          )
        : 0,
    [allComments, currentMembershipId],
  );

  return { query, allComments, sendComment, markRead, deleteComment, unreadCount };
}
