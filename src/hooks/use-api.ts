import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useRef } from 'react';
import { apiUrl } from '@/lib/api';
import { useI18n } from '@/providers/i18n-provider';

/** How long to reuse a cached Clerk JWT (ms). Clerk JWTs are valid for 60s. */
const TOKEN_CACHE_TTL = 10_000;

/** Abort a request that stalls longer than this (ms) so the UI can recover. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Error thrown when the API responds with a non-2xx status. `status`
 *  lets callers (react-query retry logic, AuthGate) branch on 401; `code`
 *  carries the API's structured error code (e.g. `outstanding_balance`)
 *  when the body includes one, so screens can map it to localized copy;
 *  `details` holds any other structured body fields some codes ship
 *  alongside (e.g. `endsAt` on `booking_beyond_subscription_end`) —
 *  mirrors web's fetchWithAuth, which spreads them onto the thrown error. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function useApi() {
  const { getToken, userId } = useAuth();
  const { lang } = useI18n();
  // The cached JWT is stamped with the user it was minted for. Hooks mounted
  // above the auth gate (analytics identity, push bootstrap) outlive a
  // sign-out, so an unstamped cache would hand the outgoing member's token to
  // the next sign-in for up to TOKEN_CACHE_TTL — and /users/me would answer
  // with the wrong person.
  const tokenRef = useRef<{
    value: string | null;
    expiresAt: number;
    userId: string | null;
  }>({ value: null, expiresAt: 0, userId: null });

  const getCachedToken = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now();
      if (
        !forceRefresh &&
        tokenRef.current.value &&
        tokenRef.current.userId === (userId ?? null) &&
        now < tokenRef.current.expiresAt
      ) {
        return tokenRef.current.value;
      }
      // On the 401-recovery path, bypass Clerk's own JWT cache too —
      // otherwise the "refreshed" retry resends the identical rejected
      // token (Clerk caches for ~60s) and the second 401 is guaranteed.
      const token = await getToken(
        forceRefresh ? { skipCache: true } : undefined,
      );
      tokenRef.current = {
        value: token,
        expiresAt: now + TOKEN_CACHE_TTL,
        userId: userId ?? null,
      };
      return token;
    },
    [getToken, userId],
  );

  const fetchWithAuth = useCallback(
    async (path: string, options?: RequestInit) => {
      const doFetch = async (token: string | null) => {
        // Abort a stalled request so the UI doesn't hang on a half-open
        // connection. Respect a caller-supplied signal when present.
        const controller = options?.signal ? null : new AbortController();
        const timeout = controller
          ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
          : null;
        try {
          return await fetch(`${apiUrl}${path}`, {
            ...options,
            signal: options?.signal ?? controller?.signal,
            headers: {
              'Content-Type': 'application/json',
              'X-Locale': lang,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...options?.headers,
            },
          });
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      };

      let token = await getCachedToken();
      let res = await doFetch(token);

      if (res.status === 401) {
        token = await getCachedToken(true);
        res = await doFetch(token);
      }

      if (!res.ok) {
        // Surface a typed error (incl. a hard 401 that survived the token
        // refresh above) rather than signing out / navigating from here —
        // that races react-query retries and bypasses the AuthGate error
        // screen, which now owns the retry/sign-out UX.
        let message = `API error: ${res.status}`;
        let code: string | undefined;
        let details: Record<string, unknown> | undefined;
        try {
          const body = await res.json();
          if (body?.message) {
            message = Array.isArray(body.message)
              ? body.message.join(', ')
              : String(body.message);
          }
          if (typeof body?.code === 'string') code = body.code;
          if (body && typeof body === 'object') {
            const { message: _m, statusCode: _s, code: _c, ...rest } = body;
            if (Object.keys(rest).length > 0) details = rest;
          }
        } catch {
          // keep generic message
        }
        throw new ApiError(message, res.status, code, details);
      }

      return res.json();
    },
    [getCachedToken, lang],
  );

  return { fetchWithAuth };
}
