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
 * Whether a failure is worth a Sentry event. Pure so it can be unit-tested
 * without a Sentry client.
 *
 * Reports 5xx (our bug) and unknown exceptions. Skips 4xx, which are
 * deliberate outcomes the UI already renders — 401 auth churn the AuthGate
 * owns, plus validation/conflict codes screens map to localized copy. Also
 * skips offline/timeout noise, which on mobile would bury real defects.
 */
export function shouldReportError(error: unknown): boolean {
  if (isApiError(error)) return error.status >= 500;

  if (error instanceof Error) {
    if (error.name === 'AbortError') return false;
    if (/network request failed|network error|timeout/i.test(error.message)) {
      return false;
    }
  }

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
