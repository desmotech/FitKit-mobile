/**
 * Thin PostHog wrapper for the mobile app. Mirrors the event taxonomy
 * used by `apps/web` (`member_*` namespace) so funnels stitch
 * web → mobile without translation. Shares the same PostHog project as
 * web (distinct_id = Clerk user id on both clients).
 *
 * Safe to call from anywhere — every export is a no-op if
 * `EXPO_PUBLIC_POSTHOG_KEY` is unset, so dev builds without a key stay
 * silent rather than crash.
 */
import PostHog from 'posthog-react-native';
import { featureFlagBootstrap, posthogHost, posthogKey } from './api';

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
    // Seed flags from env for local/preview testing (web mirrors this via
    // NEXT_PUBLIC_FEATURE_FLAGS). Empty in prod, where PostHog is the
    // source of truth and reloads flags after identify/group.
    ...(featureFlagBootstrap
      ? { bootstrap: { featureFlags: featureFlagBootstrap } }
      : {}),
  });
  return client;
}

/**
 * Exposes the lazily-constructed client for the feature-flag hook.
 * Returns null when PostHog is disabled (no key).
 */
export function getClient(): PostHog | null {
  return ensure();
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

/**
 * Associates subsequent events with a group (e.g. organization), so
 * funnels and cohorts can segment by gym. Mirrors apps/web's
 * `posthog.group('organization', ...)`.
 */
export function group(
  groupType: string,
  groupKey: string,
  properties?: EventProperties,
) {
  const c = ensure();
  if (!c) return;
  try {
    c.group(groupType, groupKey, properties as never);
  } catch {
    /* swallow */
  }
}

/**
 * Registers super properties attached to every subsequent event
 * (e.g. `membership_role`). Mirrors apps/web's `posthog.register(...)`.
 */
export function register(properties: EventProperties) {
  const c = ensure();
  if (!c) return;
  try {
    void c.register(properties as never);
  } catch {
    /* swallow */
  }
}

/**
 * Captures a `$screen` event. Mirrors apps/web's `$pageview` so
 * navigation funnels work the same across clients.
 */
export function screen(name: string, properties?: EventProperties) {
  const c = ensure();
  if (!c) return;
  try {
    void c.screen(name, properties as never);
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

export const analytics = { track, identify, group, register, screen, reset };
