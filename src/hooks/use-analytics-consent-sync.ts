import { useEffect, useRef } from 'react';
import { setAnalyticsConsent } from '@/lib/analytics';
import { loadAnalyticsConsentRaw } from '@/lib/settings-store';
import { useApiQuery } from './use-api-query';

interface UserMeEnvelope {
  data?: { analyticsConsent?: boolean | null };
}

/**
 * Adopts the analytics answer the member already gave elsewhere.
 *
 * A member who registers through a join link gives (or withholds) analytics
 * consent on the web form, and never sees `/onboarding/accept-terms` — their
 * legal consent was recorded server-side during registration, so the gate that
 * carries the analytics checkbox is skipped. Without this the app would keep
 * its own local default and ignore the answer they already gave.
 *
 * Only ever fills a gap:
 *  - runs when this device has NO stored answer (`null`), never over one
 *  - adopts only an explicit server `true`/`false`, never a null
 *
 * So a decline on this device is never overwritten by the server, and silence
 * on the server is never read as consent.
 */
export function useAnalyticsConsentSync() {
  const appliedRef = useRef(false);

  // `/users/me` is already fetched and cached by the app; this reuses that
  // entry rather than adding a request.
  const { data } = useApiQuery<UserMeEnvelope>({ path: '/users/me' });
  const serverConsent = data?.data?.analyticsConsent ?? null;

  useEffect(() => {
    if (appliedRef.current) return;
    if (serverConsent === null || serverConsent === undefined) return;

    let cancelled = false;
    void loadAnalyticsConsentRaw().then((local) => {
      if (cancelled || appliedRef.current) return;
      // Already answered on this device — their local choice wins.
      if (local !== null) {
        appliedRef.current = true;
        return;
      }
      appliedRef.current = true;
      setAnalyticsConsent(serverConsent);
    });

    return () => {
      cancelled = true;
    };
  }, [serverConsent]);
}
