import * as Sentry from '@sentry/react-native';

/**
 * Central error reporting for failed queries/mutations.
 *
 * Until 2026-07-31 the app called `Sentry.captureException` exactly once in
 * the entire codebase (an upload hook), so every failed API call died inside
 * UI copy. The fitkit-mobile Sentry project had received one event in its
 * lifetime while a compliance signature was 500ing in production for a real
 * customer — the backend saw it, the client reported nothing. This module is
 * the missing path from "a request failed" to "we know about it".
 *
 * `ApiError` is matched structurally rather than by importing it from
 * `@/hooks/use-api`: that module pulls in Clerk and React hooks, which has no
 * business being dragged into a reporting helper.
 */
type ApiErrorLike = Error & {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
};

function isApiError(error: unknown): error is ApiErrorLike {
  return (
    error instanceof Error &&
    error.name === 'ApiError' &&
    typeof (error as ApiErrorLike).status === 'number'
  );
}

/**
 * Offline / cancellation churn. On mobile this is constant and would bury
 * real defects, so every reporting path drops it.
 */
export function isNoiseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  return /network request failed|network error|timeout/i.test(error.message);
}

/**
 * Whether a failure is worth a Sentry event. Pure so it can be unit-tested
 * without a Sentry client.
 *
 * Reports 5xx (our bug) and unknown exceptions. Skips 4xx, which are
 * deliberate outcomes the UI already renders — 401 auth churn the AuthGate
 * owns, plus validation/conflict codes screens map to localized copy. Also
 * skips offline/timeout noise, which on mobile would bury real defects.
 *
 * NOTE the 4xx rule rests on "the UI already renders it". Where that is not
 * true — an API code no screen has copy for — `reportUnmappedApiCode` closes
 * the gap, because otherwise such a refusal is now invisible on both sides:
 * the member sees generic copy and Sentry sees nothing.
 */
export function shouldReportError(error: unknown): boolean {
  if (isApiError(error)) return error.status >= 500;
  if (isNoiseError(error)) return false;
  return true;
}

/**
 * Report a failed query/mutation to Sentry with enough context to act on:
 * which key failed, the HTTP status, and the API's structured error code.
 * Grouped by source + code/status so one broken endpoint is one issue rather
 * than one issue per screen that happens to call it.
 */
export function reportQueryError(
  error: unknown,
  context: { source: 'query' | 'mutation'; key?: unknown },
): void {
  if (!shouldReportError(error)) return;

  const status = isApiError(error) ? error.status : undefined;
  const code = isApiError(error) ? error.code : undefined;

  Sentry.captureException(error, {
    tags: {
      error_source: context.source,
      ...(status !== undefined ? { api_status: String(status) } : {}),
      ...(code ? { api_code: code } : {}),
    },
    contexts: {
      react_query: {
        source: context.source,
        key: safeKey(context.key),
        ...(isApiError(error) && error.details
          ? { details: error.details }
          : {}),
      },
    },
    fingerprint: ['{{ default }}', context.source, code ?? String(status ?? '')],
  });
}

/** Query keys are arbitrary structures; never let serialization throw. */
function safeKey(key: unknown): string {
  if (key === undefined) return '(none)';
  try {
    return JSON.stringify(key) ?? String(key);
  } catch {
    return '(unserializable)';
  }
}

/**
 * Report a failure a screen caught and handled itself, on a path react-query
 * does not own.
 *
 * The QueryCache/MutationCache hooks above cover every query and mutation,
 * but not raw `fetchWithAuth` calls, direct Clerk mutations, or the upload
 * helpers — and those `catch` blocks render copy and return, which is where
 * the error used to stop. Account deletion failing silently is the case that
 * matters most: it is destructive, one-shot, and the member is told only that
 * it did not work.
 *
 * Unlike `shouldReportError` this does NOT skip 4xx. These paths have no
 * screen-level mapping to lean on, so a 4xx here is a real unknown. Offline
 * churn is still dropped.
 */
export function reportHandledError(
  error: unknown,
  context: { feature: string; extra?: Record<string, unknown> },
): void {
  if (isNoiseError(error)) return;

  const status = isApiError(error) ? error.status : undefined;
  const code = isApiError(error) ? error.code : undefined;

  Sentry.captureException(error, {
    tags: {
      error_source: 'handled',
      feature: context.feature,
      ...(status !== undefined ? { api_status: String(status) } : {}),
      ...(code ? { api_code: code } : {}),
    },
    contexts: {
      handled: {
        feature: context.feature,
        ...(context.extra ?? {}),
        ...(isApiError(error) && error.details
          ? { details: error.details }
          : {}),
      },
    },
    fingerprint: ['{{ default }}', 'handled', context.feature, code ?? String(status ?? '')],
  });
}

/**
 * Flag an API error code no locale table maps.
 *
 * Screens now show their own copy instead of echoing the server's message,
 * which means an unmapped code produces a generic line and no trace of WHY.
 * This is the feedback loop that turns "there are probably more codes we
 * don't localize" into a list: one Sentry issue per unmapped code, carrying
 * the server's own wording so the copy can be written from it.
 *
 * A warning rather than an exception — nothing crashed, and it must never
 * page anyone.
 */
export function reportUnmappedApiCode(
  error: unknown,
  context: { feature: string },
): void {
  if (!isApiError(error) || !error.code) return;
  if (isNoiseError(error)) return;

  Sentry.captureMessage(`Unmapped API error code: ${error.code}`, {
    level: 'warning',
    tags: {
      error_source: 'unmapped_code',
      feature: context.feature,
      api_code: error.code,
      api_status: String(error.status),
    },
    contexts: {
      unmapped_code: {
        code: error.code,
        status: error.status,
        // The server's own wording — the raw material for the missing copy.
        server_message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    fingerprint: ['unmapped-api-code', error.code],
  });
}
