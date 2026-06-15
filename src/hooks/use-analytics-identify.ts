/**
 * Keeps PostHog + Sentry identity in sync with the active Clerk user and
 * their org membership. Mounted once near the root of the app (in
 * `_layout.tsx`). Port of apps/web's `AnalyticsUserSync` + `UserProvider`.
 *
 * - distinct_id = `user.id` so funnels stitch with web cleanly.
 * - Sentry.setUser({ id, email }) + the `posthog_session_id` tag cross-link
 *   crash/perf reports to the PostHog session replay (full correlation).
 * - Group + `membership_role` mirror the web so funnels/cohorts segment by
 *   gym and role across both clients.
 *
 * Consent split (mirrors web): PostHog identify/group is consent-gated (a
 * no-op until the user opts in); Sentry identity is NOT gated — it's
 * diagnostics / app-functionality, disclosed in the privacy policy, and the
 * privacy manifest declares crash/perf as identity-linked accordingly.
 */
import { useUser } from '@clerk/clerk-expo';
import * as Sentry from '@sentry/react-native';
import { useEffect, useSyncExternalStore } from 'react';
import {
  getAnalyticsConsent,
  getClient,
  group,
  identify,
  register,
  reset,
  subscribeAnalyticsConsent,
} from '@/lib/analytics';
import { useCurrentUser } from '@/hooks/use-current-user';

export function useAnalyticsIdentify() {
  const { user, isLoaded } = useUser();
  const { activeOrganization, primaryRole } = useCurrentUser();
  // Re-run when the user opts in — PostHog is a no-op until consent is
  // granted, so without this the first identify (and session link) is lost.
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    getAnalyticsConsent,
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? undefined,
      });
      identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
      // Cross-link Sentry → PostHog session replay. Only set when PostHog is
      // live (consent granted), else there's no session to point at.
      const sessionId = getClient()?.getSessionId();
      if (sessionId) Sentry.setTag('posthog_session_id', sessionId);
    } else {
      Sentry.setUser(null);
      reset();
    }
  }, [user, isLoaded, consent]);

  useEffect(() => {
    if (!activeOrganization || !primaryRole) return;
    // Sentry org/role context is ungated (mirrors web's UserProvider).
    Sentry.setTag('orgId', activeOrganization.id);
    Sentry.setTag('role', primaryRole);
    if (!consent) return;
    group('organization', activeOrganization.id, {
      name: activeOrganization.name,
    });
    register({ membership_role: primaryRole });
  }, [activeOrganization, primaryRole, consent]);
}
