/**
 * Keeps the PostHog distinct_id in sync with the active Clerk user.
 * Mounted once near the root of the app (in `_layout.tsx`). Uses
 * `user.id` as distinct_id so funnels stitch with web cleanly — the
 * web's `AnalyticsUserSync` identifies with the same id.
 */
import { useUser } from '@clerk/clerk-expo';
import { useEffect } from 'react';
import { identify, reset } from '@/lib/analytics';

export function useAnalyticsIdentify() {
  const { user, isLoaded } = useUser();

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
}
