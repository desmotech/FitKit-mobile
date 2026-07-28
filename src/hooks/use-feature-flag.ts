/**
 * PostHog feature-flag hooks — mobile port of
 * apps/web/src/hooks/use-feature-flag.ts.
 *
 * Fail-closed on purpose: `enabled` is true only when PostHog affirmatively
 * returns `true`. A missing key, unreachable PostHog, undecided flags, or an
 * opted-out user (the client is consent-gated in src/lib/analytics.ts) all
 * read as "off" — new gated capabilities must never appear because a flag
 * read failed. Per-org targeting rides the `organization` group that
 * use-analytics-identify.ts already registers.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getAnalyticsConsent,
  getClient,
  subscribeAnalyticsConsent,
} from '@/lib/analytics';

interface GatedFeature {
  /** Strict: PostHog returned `true`. */
  enabled: boolean;
  /** Flags not resolved yet — hide gated UI instead of flashing it. */
  isLoading: boolean;
}

/**
 * Gated read of a boolean flag. Mirrors web's `useGatedFeature`: callers get
 * `{ enabled, isLoading }` so flag-gated UI renders nothing until PostHog
 * resolves, rather than flashing on/off.
 */
export function useGatedFeature(flag: string): GatedFeature {
  // Re-evaluate when consent flips — the PostHog client only exists after
  // the user opts in, and flags load shortly after construction.
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    getAnalyticsConsent,
  );

  const [state, setState] = useState<GatedFeature>(() => ({
    enabled: false,
    isLoading: consent && !!getClient(),
  }));

  useEffect(() => {
    const client = getClient();
    if (!client) {
      // No consent or no PostHog key — flags can never resolve: fail closed.
      setState({ enabled: false, isLoading: false });
      return;
    }
    const read = () => {
      const value = client.getFeatureFlag(flag);
      setState({ enabled: value === true, isLoading: value === undefined });
    };
    read();
    // Fires whenever flags load/reload (identify, group, reload). Returns an
    // unsubscribe function — same wiring as posthog-react-native's own
    // useFeatureFlag hook.
    return client.onFeatureFlags(read);
  }, [flag, consent]);

  return state;
}

/** Boolean convenience wrapper — loading collapses to `false`. */
export function useFeatureFlag(flag: string): boolean {
  return useGatedFeature(flag).enabled;
}
