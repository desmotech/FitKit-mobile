/**
 * Conversations list — port of `apps/web/src/hooks/messages/use-conversations.ts`.
 * Lists DM partners with last-message preview + unread count. Workout-anchored
 * comments are filtered out server-side so this is the plain inbox view.
 *
 * Mobile v1 ships without realtime: the list refreshes via TanStack's
 * `staleTime` (30s) and on focus. When the mobile socket lands, wire
 * `onMessage` + `onUnreadUpdated` here to mirror web.
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
