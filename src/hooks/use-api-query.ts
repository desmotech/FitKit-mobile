import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from './use-api';

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
    queryKey: options.queryKey ?? [options.path],
    queryFn: () => fetchWithAuth(options.path) as Promise<T>,
    enabled: queryEnabled,
    ...options.queryOptions,
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
