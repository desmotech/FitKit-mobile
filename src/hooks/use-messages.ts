/**
 * Single-conversation thread — port of
 * `apps/web/src/hooks/messages/use-messages.ts`.
 *
 * Endpoints (all org-scoped):
 *   GET    /conversations/:participantId?limit=&cursor= — paged thread
 *   POST   /messages — send DM (recipientMembershipId in body)
 *   PUT    /conversations/:participantId/read — mark thread read
 *   DELETE /messages/:id — delete own message
 *
 * Same shape as `use-workout-comments`: infinite query + mutations with
 * optimistic cache writes, plus realtime: incoming messages prepend to the
 * open thread and read receipts flip the sent-message ticks live.
 */
import { useEffect, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import type {
  CreateMessageInput,
  MessageResponse,
  MessagesListResponse,
} from '@taikan/shared';
import { useRealtime } from '@/providers/realtime-provider';
import { useApi } from './use-api';
import { queryKeys } from '@/lib/query-keys';

type Page = MessagesListResponse;
type InfiniteData = { pages: { data: Page }[]; pageParams: unknown[] };

export function useMessages(
  orgId: string | undefined | null,
  participantMembershipId: string | undefined | null,
  currentMembershipId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const { onMessage, onReadReceipt } = useRealtime();
  const queryClient = useQueryClient();

  const enabled =
    !!orgId &&
    !!participantMembershipId &&
    !!currentMembershipId &&
    isLoaded &&
    isSignedIn === true;

  const queryKey = queryKeys.messageThreads.thread(orgId, participantMembershipId);

  const query = useInfiniteQuery<{ data: Page }>({
    queryKey,
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam as string}` : '';
      return fetchWithAuth(
        `/organizations/${orgId}/conversations/${participantMembershipId}?limit=50${cursor}`,
      ) as Promise<{ data: Page }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    enabled,
    staleTime: 30_000,
  });

  // Realtime: a message from the other participant in THIS thread prepends to
  // the cache so it appears without a refetch. Own messages aren't broadcast
  // back to us (the server only emits to the recipient); workout-anchored
  // comments live in their own thread and are ignored here.
  useEffect(() => {
    if (!participantMembershipId || !currentMembershipId) return;
    const unsub = onMessage((msg) => {
      if (msg.workoutAssignmentId) return;
      if (msg.senderMembershipId === currentMembershipId) return;
      const belongsHere =
        msg.senderMembershipId === participantMembershipId &&
        msg.recipientMembershipId === currentMembershipId;
      if (!belongsHere) return;

      queryClient.setQueryData<InfiniteData>(queryKey, (old) => {
        if (!old) return old;
        const exists = old.pages.some((p) =>
          p.data.messages.some((m) => m.id === msg.id),
        );
        if (exists) return old;
        const [firstPage, ...rest] = old.pages;
        if (!firstPage) return old;
        return {
          ...old,
          pages: [
            {
              data: {
                ...firstPage.data,
                messages: [msg, ...firstPage.data.messages],
              },
            },
            ...rest,
          ],
        };
      });
    });
    return unsub;
    // queryKey is derived from the same ids in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    participantMembershipId,
    currentMembershipId,
    onMessage,
    queryClient,
  ]);

  // Realtime: the recipient read one of our sent messages — flip its tick.
  useEffect(() => {
    const unsub = onReadReceipt(({ messageId, readAt }) => {
      queryClient.setQueryData<InfiniteData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            data: {
              ...page.data,
              messages: page.data.messages.map((m) =>
                m.id === messageId ? { ...m, readAt } : m,
              ),
            },
          })),
        };
      });
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantMembershipId, onReadReceipt, queryClient]);

  const sendMessage = useMutation<
    { data: MessageResponse },
    Error,
    Omit<CreateMessageInput, 'recipientMembershipId'>
  >({
    mutationFn: (input) =>
      fetchWithAuth(`/organizations/${orgId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          recipientMembershipId: participantMembershipId,
        }),
      }) as Promise<{ data: MessageResponse }>,
    onSuccess: (result) => {
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
      // Bump the list so the new message + lastMessageAt appear in the
      // conversation row immediately.
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(orgId ?? 'noop'),
      });
    },
  });

  const markRead = useMutation<{ data: { markedCount: number } }, Error, void>({
    mutationFn: () =>
      fetchWithAuth(
        `/organizations/${orgId}/conversations/${participantMembershipId}/read`,
        { method: 'PUT' },
      ) as Promise<{ data: { markedCount: number } }>,
    onSuccess: (result) => {
      if (!result?.data?.markedCount) return;
      queryClient.setQueryData<InfiniteData>(queryKey, (old) => {
        if (!old || !currentMembershipId) return old;
        const readAtIso = new Date().toISOString();
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(orgId ?? 'noop'),
      });
      // The unified inbox badge (member header + app icon) counts these.
      queryClient.invalidateQueries({
        queryKey: queryKeys.badge.total(orgId ?? 'noop'),
      });
    },
  });

  const deleteMessage = useMutation<
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

  // Memoized: an unstable array identity here cascades into the thread
  // screen's items/unread memos on every render (incl. each keystroke).
  const pages = query.data?.pages;
  const allMessages = useMemo(
    () => pages?.flatMap((p) => p.data.messages) ?? [],
    [pages],
  );

  return { query, allMessages, sendMessage, markRead, deleteMessage };
}
