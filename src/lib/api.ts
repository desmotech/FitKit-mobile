import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
  wsUrl?: string;
  webUrl?: string;
  clerkPublishableKey?: string;
  sentryDsn?: string;
  posthogKey?: string;
  posthogHost?: string;
  featureFlags?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const apiUrl = extra.apiUrl ?? 'http://localhost:3001';
export const wsUrl = extra.wsUrl ?? 'http://localhost:3001';
export const webUrl = extra.webUrl ?? 'http://localhost:3000';
export const clerkPublishableKey = extra.clerkPublishableKey ?? '';
export const sentryDsn = extra.sentryDsn ?? '';
export const posthogKey = extra.posthogKey ?? '';
export const posthogHost = extra.posthogHost ?? 'https://eu.i.posthog.com';

/**
 * Parses `EXPO_PUBLIC_FEATURE_FLAGS` ("flag-a:true,flag-b:false") into a
 * bootstrap map used to seed PostHog for local/preview testing. Mirrors
 * apps/web's `NEXT_PUBLIC_FEATURE_FLAGS`. Returns undefined when unset so
 * prod relies entirely on PostHog as the source of truth.
 */
function parseFeatureFlags(raw: string): Record<string, boolean> | undefined {
  const flags: Record<string, boolean> = {};
  for (const pair of raw.split(',')) {
    const [key, val] = pair.split(':');
    if (key && val !== undefined) flags[key.trim()] = val.trim() === 'true';
  }
  return Object.keys(flags).length > 0 ? flags : undefined;
}

export const featureFlagBootstrap = extra.featureFlags
  ? parseFeatureFlags(extra.featureFlags)
  : undefined;

/**
 * Payment providers reject non-web return URLs (Morning errors with 1103 on
 * `taikan://` links), so hosted-checkout return URLs go through the API's
 * HTTPS bridge, which 302s back to `taikan://<appPath>` with all params
 * (these plus any the API/provider appended, e.g. `sub`). The bridge redirect
 * is what closes `openAuthSessionAsync` — keep watching the `taikan://` URL
 * as its callback.
 */
export function paymentReturnUrl(
  appPath: string,
  params: Record<string, string>,
): string {
  const qs = new URLSearchParams({ to: appPath, ...params });
  return `${apiUrl}/payments/app-return?${qs.toString()}`;
}
