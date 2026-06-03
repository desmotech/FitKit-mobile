/**
 * Keeps PostHog identity in sync with the active Clerk user and their
 * org membership. Mounted once near the root of the app (in
 * `_layout.tsx`).
 *
 * - distinct_id = `user.id` so funnels stitch with web cleanly (the web's
 *   `AnalyticsUserSync` identifies with the same id).
 * - Group + `membership_role` mirror apps/web's `UserProvider`, so
 *   funnels/cohorts segment by gym and role across both clients.
 */
import { useUser } from '@clerk/clerk-expo';
import { useEffect } from 'react';
import { group, identify, register, reset } from '@/lib/analytics';
import { useCurrentUser } from '@/hooks/use-current-user';

export function useAnalyticsIdentify() {
  const { user, isLoaded } = useUser();
  const { activeOrganization, primaryRole } = useCurrentUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    } else {
      reset();
    }
  }, [user, isLoaded]);

  useEffect(() => {
    if (activeOrganization && primaryRole) {
      group('organization', activeOrganization.id, {
        name: activeOrganization.name,
      });
      register({ membership_role: primaryRole });
    }
  }, [activeOrganization, primaryRole]);
}
