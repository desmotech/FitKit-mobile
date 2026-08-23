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
import { saveAnalyticsConsent } from './settings-store';

// PostHog's strict `PostHogEventProperties` recursively enforces JsonType.
// We treat properties as a permissive bag at the call site (numbers,
// booleans, strings, undefined) and trust PostHog's JSON serializer to
// stringify them; the cast lives here so call sites stay readable.
type EventProperties = Record<string, unknown>;

let client: PostHog | null = null;
let inited = false;

// Analytics stays OFF until the user opts in — matches the web app's
// decline-by-default cookie consent. Hydrated from storage at startup, then
// flipped from the accept-terms checkbox / Profile > Privacy toggle.
let consentGranted = false;
const consentListeners = new Set<() => void>();

function notifyConsent() {
  for (const l of consentListeners) {
    try {
      l();
    } catch {
      /* swallow */
    }
  }
}

function ensure(): PostHog | null {
  // Gate before marking `inited` so a later opt-in can still construct.
  if (!consentGranted) return null;
  if (inited) return client;
  inited = true;
  if (!posthogKey) return null;
  client = new PostHog(posthogKey, {
    host: posthogHost,
    captureAppLifecycleEvents: true,
    // Screenshot-mode replay, via the native `posthog-react-native-session-
    // replay` module. Constructing here means recording starts only after
    // consent, same as every event.
    enableSessionReplay: true,
    // Spelled out rather than left to defaults: these three are the whole
    // privacy story for a screenshot recorder. Plain `<Text>` is NOT covered
    // by `maskAllTextInputs` — screens showing health or payment data wrap
    // themselves in `PostHogMaskView`.
    sessionReplayConfig: {
      maskAllTextInputs: true,
      maskAllImages: true,
      maskAllSandboxedViews: true,
    },
    // Seed flags from env for local/preview testing (web mirrors this via
    // NEXT_PUBLIC_FEATURE_FLAGS). Empty in prod, where PostHog is the
    // source of truth and reloads flags after identify/group.
    ...(featureFlagBootstrap
      ? { bootstrap: { featureFlags: featureFlagBootstrap } }
      : {}),
  });
  return client;
}

/** Current opt-in state (synchronous — safe for useSyncExternalStore). */
export function getAnalyticsConsent(): boolean {
  return consentGranted;
}

/** Subscribe to consent changes so identity sync can re-run on opt-in. */
export function subscribeAnalyticsConsent(cb: () => void): () => void {
  consentListeners.add(cb);
  return () => {
    consentListeners.delete(cb);
  };
}

/** Apply the persisted choice at startup. Constructs eagerly when granted so
 *  app-open / lifecycle events are captured from launch; never re-persists. */
export function hydrateAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  if (granted) ensure();
  notifyConsent();
}

/** Flip consent at runtime (accept-terms checkbox / Profile toggle). Persists
 *  the choice, enables or disables the live client, and notifies subscribers. */
export function setAnalyticsConsent(granted: boolean): void {
  if (granted === consentGranted) return;
  consentGranted = granted;
  void saveAnalyticsConsent(granted);
  if (granted) {
    // A client that already exists was opted out earlier in this run, and
    // `ensure()` will not restart its recorder — the native side is only
    // started once, at construction.
    const wasConstructed = client !== null;
    const c = ensure();
    try {
      void c?.optIn();
      if (wasConstructed) void c?.startSessionRecording(false);
    } catch {
      /* swallow */
    }
  } else if (client) {
    try {
      // Must come first and must be explicit: the recorder runs in native
      // code with its own copy of the API key and uploads snapshots itself,
      // so `optOut()` — which only gates the JS capture queue — leaves it
      // recording.
      void client.stopSessionRecording();
      void client.optOut();
      client.reset();
    } catch {
      /* swallow */
    }
  }
  notifyConsent();
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
