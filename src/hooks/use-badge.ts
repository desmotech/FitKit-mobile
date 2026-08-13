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
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useApiQuery } from './use-api-query';
import {
  countActionableForms,
  useIncompleteFormsCount,
  type MyFormEntry,
} from './use-forms';
import { reportBadgeError } from '@/lib/error-reporting';
import { queryKeys } from '@/lib/query-keys';

const badgeKey = queryKeys.badge.total;
const myFormsKey = queryKeys.forms.mine;

type BadgeEnvelope = { data: { count: number } };
type FormsEnvelope = { data: MyFormEntry[] };

/**
 * Write the icon. Never swallow a rejection: `setBadgeCountAsync` fails for
 * reasons invisible from here (permission revoked, launcher without badge
 * support), and a silent failure leaves a wrong number on the member's home
 * screen with nobody the wiser.
 */
function writeBadge(total: number, phase: 'sync' | 'resume'): void {
  Notifications.setBadgeCountAsync(total).catch((error) => {
    reportBadgeError(error, { total, phase });
  });
}

/**
 * Server-resolved unified unread total for the member in this org
 * (messages + workout comments + announcements). Short stale time; the
 * foreground listener in `useAppIconBadge` forces a refetch on resume.
 */
export function useBadgeTotal(orgId: string | undefined | null) {
  return useApiQuery<BadgeEnvelope>({
    path: orgId ? `/organizations/${orgId}/badge` : '',
    queryKey: orgId ? badgeKey(orgId) : ['badge-total', 'noop'],
    queryOptions: { enabled: !!orgId, staleTime: 15_000 },
  });
}

/**
 * Re-sync the icon to server truth after a resume.
 *
 * Refetches both counts and then writes the icon **unconditionally**, rather
 * than leaving the write to the render effect below. That effect is keyed on
 * the count values, so it only fires when a count *changes* — and the common
 * resume case is precisely that nothing changed: a push raised the OS badge to
 * 1 while we were backgrounded, the member read the message elsewhere, and the
 * refetch returns the same 0 the cache already held. React sees no state
 * change, the effect never re-runs, and the push's 1 stays on the icon
 * forever. Cold start cleared it (fresh mount, `undefined → 0`), resume never
 * did — which is exactly how the ghost badge presented in prod.
 */
async function resyncBadge(queryClient: QueryClient, orgId: string) {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: badgeKey(orgId) }),
    queryClient.refetchQueries({ queryKey: myFormsKey(orgId) }),
  ]);

  const serverCount =
    queryClient.getQueryData<BadgeEnvelope>(badgeKey(orgId))?.data.count;
  // Same guard as the render effect: with no server number, writing would
  // clear a legitimate push count down to the forms-only total.
  if (serverCount == null) return;

  const forms = countActionableForms(
    queryClient.getQueryData<FormsEnvelope>(myFormsKey(orgId))?.data,
  );
  writeBadge(serverCount + forms, 'resume');
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
  // were backgrounded — and a push may have moved the icon in the meantime.
  useEffect(() => {
    if (!orgId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resyncBadge(queryClient, orgId);
    });
    return () => sub.remove();
  }, [orgId, queryClient]);

  const serverCount = badgeQuery.data?.data.count;
  useEffect(() => {
    // Don't touch the badge until we actually have a server number for this
    // org — otherwise a cold start would flash the icon to 0 (forms-only)
    // and wipe whatever count a push set while the app was closed.
    if (!orgId || serverCount == null) return;
    writeBadge(serverCount + formsCount, 'sync');
  }, [orgId, serverCount, formsCount]);
}
