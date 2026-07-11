/**
 * App-icon badge ownership.
 *
 * The native badge is a single number, so exactly one place may set it —
 * otherwise independent setters clobber each other (this was FIT-198: message
 * pushes, the forms badge, and a foreground "clear to 0" all fought over it).
 *
 * `useAppIconBadge` is that single owner for a signed-in member. It mirrors the
 * server's authoritative unread total (messages + workout comments + unread
 * announcements, from `GET /organizations/:orgId/badge`) and adds the locally
 * derived count of forms still awaiting the member's action. It re-syncs on
 * foreground so the icon settles to the truth once the member has read things
 * elsewhere — never blindly resetting to 0.
 *
 * (Signed-out badge clearing lives in `usePushNotifications`, which is mounted
 * above the auth gate.)
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from './use-api-query';
import { useIncompleteFormsCount } from './use-forms';
import { queryKeys } from '@/lib/query-keys';

const badgeKey = queryKeys.badge.total;
const myFormsKey = queryKeys.forms.mine;

/**
 * Server-resolved unified unread total for the member in this org
 * (messages + workout comments + announcements). Short stale time; the
 * foreground listener in `useAppIconBadge` forces a refetch on resume.
 */
export function useBadgeTotal(orgId: string | undefined | null) {
  return useApiQuery<{ data: { count: number } }>({
    path: orgId ? `/organizations/${orgId}/badge` : '',
    queryKey: orgId ? badgeKey(orgId) : ['badge-total', 'noop'],
    queryOptions: { enabled: !!orgId, staleTime: 15_000 },
  });
}

/**
 * Keeps the iOS/Android app-icon badge in sync with the member's true unread
 * total. Mount once, inside the authenticated tabs tree.
 */
export function useAppIconBadge(orgId: string | undefined | null) {
  const badgeQuery = useBadgeTotal(orgId);
  const formsCount = useIncompleteFormsCount(orgId);
  const queryClient = useQueryClient();

  // Re-sync on foreground: a member may have read messages/announcements or
  // completed forms on another device (or via a notification action) while we
  // were backgrounded. Invalidating forces both counts to refetch; the effect
  // below then restamps the badge with the fresh total.
  useEffect(() => {
    if (!orgId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: badgeKey(orgId) });
        queryClient.invalidateQueries({ queryKey: myFormsKey(orgId) });
      }
    });
    return () => sub.remove();
  }, [orgId, queryClient]);

  const serverCount = badgeQuery.data?.data.count;
  useEffect(() => {
    // Don't touch the badge until we actually have a server number for this
    // org — otherwise a cold start would flash the icon to 0 (forms-only)
    // and wipe whatever count a push set while the app was closed.
    if (!orgId || serverCount == null) return;
    const total = serverCount + formsCount;
    Notifications.setBadgeCountAsync(total).catch(() => undefined);
  }, [orgId, serverCount, formsCount]);
}
