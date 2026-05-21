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
 * optimistic cache writes. No realtime hookup yet.
 */
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
} from '@fitkit/shared';
import { useApi } from './use-api';

type Page = MessagesListResponse;
type InfiniteData = { pages: { data: Page }[]; pageParams: unknown[] };

export function useMessages(
  orgId: string | undefined | null,
  participantMembershipId: string | undefined | null,
  currentMembershipId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const enabled =
    !!orgId &&
    !!participantMembershipId &&
    !!currentMembershipId &&
    isLoaded &&
    isSignedIn === true;

  const queryKey = ['messages', orgId, participantMembershipId] as const;

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
        queryKey: [`/organizations/${orgId}/conversations?limit=50`],
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
        queryKey: [`/organizations/${orgId}/conversations?limit=50`],
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

  const allMessages =
    query.data?.pages.flatMap((p) => p.data.messages) ?? [];

  return { query, allMessages, sendMessage, markRead, deleteMessage };
}
