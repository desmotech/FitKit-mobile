/**
 * Conversations list — port of `apps/web/src/hooks/messages/use-conversations.ts`.
 * Lists DM partners with last-message preview + unread count. Workout-anchored
 * comments are filtered out server-side so this is the plain inbox view.
 *
 * Live updates: `use-realtime-subscription` (mounted in the tab shell)
 * invalidates this query on `message` / `unread:updated` socket events, so
 * the inbox preview + unread badge stay current without polling. TanStack's
 * `staleTime` (30s) + focus refetch are the offline/cold-start fallback.
 */
import type { ConversationsListResponse } from '@fitkit/shared';
import { useApiQuery } from './use-api-query';

export function useConversations(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/conversations?limit=50` : '';
  const query = useApiQuery<{ data: ConversationsListResponse }>({
    path,
    queryOptions: {
      enabled: !!orgId,
      staleTime: 30_000,
      refetchOnMount: true,
    },
  });
  return { ...query, data: query.data?.data };
}

/** Sum of `unreadCount` across all conversations — for the tab badge. */
export function useTotalUnread(orgId: string | undefined | null): number {
  const { data } = useConversations(orgId);
  const conversations = data?.conversations ?? [];
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}
