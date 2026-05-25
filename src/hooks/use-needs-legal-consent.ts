/**
 * useNeedsLegalConsent — consent gate driven by /legal/consents/status.
 *
 * The status list is the precise source of truth: it returns per-doc
 * timestamps and a `requiresReconsent` flag. We treat any required doc
 * (terms_of_use, privacy_policy, fitness_waiver) with no `consentedAt`
 * or `requiresReconsent=true` as needing consent.
 *
 * We deliberately do NOT short-circuit on `user.pendingLegalConsents`:
 *  - That denormalized summary on /users/me has been observed
 *    stale-true (default for fresh invite-created accounts) and
 *    stale-true-after-recording (server doesn't always recompute it
 *    when a consent row is written). Short-circuiting on the flag
 *    would cause the gate to ping-pong after a successful submit.
 *  - Driving solely off the status list means LegalConsentForm only
 *    needs to invalidate ONE query after a successful POST, not two.
 *
 * Returns null while loading so AuthGate keeps the spinner up instead
 * of briefly mounting the tab shell and then redirecting.
 */
import { useMemo } from 'react';
import type { ConsentStatusItem } from '@fitkit/shared';
import { useConsentStatus } from './use-legal';

const REQUIRED_TYPES: ConsentStatusItem['documentType'][] = [
  'terms_of_use',
  'privacy_policy',
  'fitness_waiver',
];

export interface NeedsLegalConsentResult {
  /** True when the gate should redirect to /onboarding/accept-terms. Null while loading. */
  needs: boolean | null;
  /** Per-doc breakdown so the consent screen can hint at what's missing. */
  missing: ConsentStatusItem['documentType'][];
}

export function useNeedsLegalConsent(): NeedsLegalConsentResult {
  const status = useConsentStatus();

  return useMemo<NeedsLegalConsentResult>(() => {
    if (status.isLoading) return { needs: null, missing: [] };

    const items = status.data?.data ?? [];
    const missing: ConsentStatusItem['documentType'][] = [];
    for (const type of REQUIRED_TYPES) {
      const item = items.find((i) => i.documentType === type);
      if (!item) {
        // No row at all — definitely needs consent.
        missing.push(type);
        continue;
      }
      if (item.consentedAt == null || item.requiresReconsent) {
        missing.push(type);
      }
    }
    return { needs: missing.length > 0, missing };
  }, [status.isLoading, status.data]);
}
