/**
 * Session-level realtime wiring. Mounted once inside the authenticated tab
 * shell (alongside `useAppIconBadge`). Joins the org room and keeps the
 * inbox list + unread badge live for the whole app — the open chat thread
 * patches its own cache in `use-messages`, so this only refreshes the
 * surfaces that aren't currently on screen.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '@/providers/realtime-provider';
import { useCurrentUser } from './use-current-user';

export function useRealtimeSubscription() {
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const membershipId = primaryMembership?.id;
  const { subscribeToOrg, onMessage, onUnreadUpdated } = useRealtime();
  const queryClient = useQueryClient();

  // Join the org room once we know who we are. The provider re-emits this on
  // every (re)connect, so we only need to declare the subscription here.
  useEffect(() => {
    if (!orgId || !membershipId) return;
    subscribeToOrg(orgId, membershipId);
  }, [orgId, membershipId, subscribeToOrg]);

  // An incoming message or unread bump should refresh the inbox preview/badge
  // even when the user isn't looking at the thread it belongs to.
  useEffect(() => {
    if (!orgId) return;
    const invalidateInbox = () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgId}/conversations?limit=50`],
      });
      queryClient.invalidateQueries({ queryKey: ['badge-total', orgId] });
    };
    const offMessage = onMessage(invalidateInbox);
    const offUnread = onUnreadUpdated(invalidateInbox);
    return () => {
      offMessage();
      offUnread();
    };
  }, [orgId, onMessage, onUnreadUpdated, queryClient]);

  // The socket sleeps in the background, so events may have been missed.
  // Refetch the inbox + any open thread on resume to close the gap.
  useEffect(() => {
    if (!orgId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgId}/conversations?limit=50`],
      });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    });
    return () => sub.remove();
  }, [orgId, queryClient]);
}
