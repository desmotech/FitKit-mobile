import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { ApiError, useApi } from './use-api';

type MutationOpts<TData, TVars> = Omit<
  UseMutationOptions<TData, Error, TVars>,
  'mutationFn'
>;

/**
 * Mirrors apps/web/src/hooks/use-api-query.ts. Auth-gated query: skips
 * the request until Clerk has resolved and confirmed a session, so we
 * never hit the API with a missing token on cold start.
 */
export function useApiQuery<T = unknown>(options: {
  path: string;
  queryKey?: readonly unknown[];
  queryOptions?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>;
}) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const queryEnabled =
    (options.queryOptions?.enabled ?? true) && isLoaded && isSignedIn === true;

  return useQuery<T>({
    ...options.queryOptions,
    queryKey: options.queryKey ?? [options.path],
    queryFn: () => fetchWithAuth(options.path) as Promise<T>,
    // Must come after the spread: the caller's `enabled` is already folded
    // into `queryEnabled`, and letting the spread win would drop the
    // Clerk auth gate (cold start with a persisted cache would fire
    // requests before a token exists).
    enabled: queryEnabled,
    // A 401 won't recover (fetchWithAuth already refreshed the token once),
    // so don't retry it — fail fast to the AuthGate error screen instead of
    // hammering the API with backoff. Other errors keep the default retries.
    retry:
      options.queryOptions?.retry ??
      ((failureCount, error) =>
        !(error instanceof ApiError && error.status === 401) &&
        failureCount < 3),
  });
}

export function useApiSend<TData = unknown, TBody = unknown>(options: {
  path: string | ((body: TBody) => string);
  method?: string;
  mutationOptions?: MutationOpts<TData, TBody>;
}) {
  const { fetchWithAuth } = useApi();
  const { path, method = 'POST', mutationOptions } = options;

  return useMutation<TData, Error, TBody>({
    mutationFn: (body) => {
      const resolvedPath = typeof path === 'function' ? path(body) : path;
      return fetchWithAuth(resolvedPath, {
        method,
        body: JSON.stringify(body),
      }) as Promise<TData>;
    },
    ...mutationOptions,
  });
}

export function useApiAction<TData = unknown, TId = void>(options: {
  path: string | ((id: TId) => string);
  method?: string;
  mutationOptions?: MutationOpts<TData, TId>;
}) {
  const { fetchWithAuth } = useApi();
  const { path, method = 'POST', mutationOptions } = options;

  return useMutation<TData, Error, TId>({
    mutationFn: (id) => {
      const resolvedPath = typeof path === 'function' ? path(id) : path;
      return fetchWithAuth(resolvedPath, { method }) as Promise<TData>;
    },
    ...mutationOptions,
  });
}
