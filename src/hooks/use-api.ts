import { useAuth, useClerk } from '@clerk/clerk-expo';
import { useCallback, useRef } from 'react';
import { router } from 'expo-router';
import { apiUrl } from '@/lib/api';
import { useI18n } from '@/providers/i18n-provider';

/** How long to reuse a cached Clerk JWT (ms). Clerk JWTs are valid for 60s. */
const TOKEN_CACHE_TTL = 10_000;

export function useApi() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { lang } = useI18n();
  const tokenRef = useRef<{ value: string | null; expiresAt: number }>({
    value: null,
    expiresAt: 0,
  });

  const getCachedToken = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now();
      if (
        !forceRefresh &&
        tokenRef.current.value &&
        now < tokenRef.current.expiresAt
      ) {
        return tokenRef.current.value;
      }
      const token = await getToken();
      tokenRef.current = { value: token, expiresAt: now + TOKEN_CACHE_TTL };
      return token;
    },
    [getToken],
  );

  const fetchWithAuth = useCallback(
    async (path: string, options?: RequestInit) => {
      const doFetch = async (token: string | null) =>
        fetch(`${apiUrl}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Locale': lang,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options?.headers,
          },
        });

      let token = await getCachedToken();
      let res = await doFetch(token);

      if (res.status === 401) {
        token = await getCachedToken(true);
        res = await doFetch(token);
      }

      if (res.status === 401) {
        try {
          await signOut();
        } finally {
          router.replace('/(auth)/sign-in');
        }
        throw new Error('Unauthorized');
      }

      if (!res.ok) {
        let message = `API error: ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) {
            message = Array.isArray(body.message)
              ? body.message.join(', ')
              : String(body.message);
          }
        } catch {
          // keep generic message
        }
        throw new Error(message);
      }

      return res.json();
    },
    [getCachedToken, signOut, lang],
  );

  return { fetchWithAuth };
}
