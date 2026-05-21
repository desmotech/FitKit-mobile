/**
 * Thin PostHog wrapper for the mobile app. Mirrors the event taxonomy
 * used by `apps/web` (`member_*` namespace) so funnels stitch
 * web → mobile without translation. Shares the same PostHog project as
 * web (distinct_id = Clerk user id on both clients).
 *
 * Safe to call from anywhere — `track`/`identify`/`reset` are no-ops if
 * `EXPO_PUBLIC_POSTHOG_KEY` is unset, so dev builds without a key stay
 * silent rather than crash.
 */
import PostHog from 'posthog-react-native';
import { posthogHost, posthogKey } from './api';

// PostHog's strict `PostHogEventProperties` recursively enforces JsonType.
// We treat properties as a permissive bag at the call site (numbers,
// booleans, strings, undefined) and trust PostHog's JSON serializer to
// stringify them; the cast lives here so call sites stay readable.
type EventProperties = Record<string, unknown>;

let client: PostHog | null = null;
let inited = false;

function ensure(): PostHog | null {
  if (inited) return client;
  inited = true;
  if (!posthogKey) return null;
  client = new PostHog(posthogKey, {
    host: posthogHost,
    captureAppLifecycleEvents: true,
  });
  return client;
}

export function track(event: string, properties?: EventProperties) {
  const c = ensure();
  if (!c) return;
  try {
    c.capture(event, properties as never);
  } catch {
    // Analytics must never break user flows.
  }
}

export function identify(distinctId: string, properties?: EventProperties) {
  const c = ensure();
  if (!c) return;
  try {
    c.identify(distinctId, properties as never);
  } catch {
    /* swallow */
  }
}

export function reset() {
  const c = ensure();
  if (!c) return;
  try {
    c.reset();
  } catch {
    /* swallow */
  }
}

export const analytics = { track, identify, reset };
