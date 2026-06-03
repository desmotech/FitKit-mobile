/**
 * Typed wrapper around PostHog feature flags. Mirrors
 * apps/web/src/hooks/use-feature-flag.ts so the same `FeatureFlag` keys
 * gate behaviour on both clients.
 *
 * In production PostHog is the source of truth (flags load on init and
 * reload after identify/group). In dev/preview the client is seeded from
 * `EXPO_PUBLIC_FEATURE_FLAGS` (see src/lib/analytics.ts). Returns false
 * when PostHog is disabled (no key) so gated UI stays off.
 */
import { useSyncExternalStore } from 'react';
import type { FeatureFlag } from '@fitkit/shared';
import { getClient } from '@/lib/analytics';

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const client = getClient();
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!client) return () => {};
      return client.onFeatureFlags(() => onStoreChange());
    },
    () => (client ? client.isFeatureEnabled(flag) === true : false),
  );
}
