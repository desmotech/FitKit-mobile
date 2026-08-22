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
import type { ConsentStatusItem } from '@taikan/shared';
import { useConsentStatus } from './use-legal';

const REQUIRED_TYPES: ConsentStatusItem['documentType'][] = [
  'terms_of_use',
  'privacy_policy',
  'fitness_waiver',
];

export interface NeedsLegalConsentResult {
  /** True when the gate should redirect to /onboarding/accept-terms.
   *  Null while loading OR on error (don't force the consent screen when
   *  we couldn't actually read the status). */
  needs: boolean | null;
  /** Per-doc breakdown so the consent screen can hint at what's missing. */
  missing: ConsentStatusItem['documentType'][];
  /** True when /legal/consents/status failed to load — AuthGate shows the
   *  account-error screen instead of bouncing into the consent flow. */
  isError: boolean;
}

export function useNeedsLegalConsent(): NeedsLegalConsentResult {
  const status = useConsentStatus();

  return useMemo<NeedsLegalConsentResult>(() => {
    if (status.isLoading) return { needs: null, missing: [], isError: false };
    // Paused with nothing cached is NOT an answer. A paused query is neither
    // loading nor errored — `isLoading` is false because nothing is in
    // flight — so without this it fell straight through to the "no consent
    // rows" branch below, read an empty list as "all three required docs
    // missing", and sent every offline member to /onboarding/accept-terms: a
    // screen they cannot complete without a network, blocking the cached
    // schedule they opened the app to read.
    //
    // The `data` check is what keeps the fix from breaking the case it
    // exists to serve. A query holding restored data is ALSO paused offline
    // — it is stale and would like to refetch — and bailing out on
    // `isPaused` alone would strand a member whose consent status we know
    // perfectly well. Paused only means "no fresh answer coming"; it says
    // nothing about whether we already have one.
    if (status.isPaused && status.data === undefined) {
      return { needs: null, missing: [], isError: false };
    }
    // On error return needs=null, NOT true. Previously an errored/empty
    // status list made every required doc look "missing" → needs=true →
    // the gate redirected to /onboarding/accept-terms, which re-hit
    // /status, errored again → loop. AuthGate now surfaces the error.
    if (status.isError) return { needs: null, missing: [], isError: true };

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
    return { needs: missing.length > 0, missing, isError: false };
  }, [status.isLoading, status.isPaused, status.isError, status.data]);
}
