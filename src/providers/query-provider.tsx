import {
  MutationCache,
  QueryCache,
  QueryClient,
  focusManager,
  keepPreviousData,
  onlineManager,
} from '@tanstack/react-query';
import { reportQueryError } from '@/lib/error-reporting';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister } from '@/lib/query-persister';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const ONE_MINUTE = 60_000;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const TWENTY_FOUR_HOURS = 24 * 60 * ONE_MINUTE;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Every failed request funnels through these two caches, so this is
        // the one place that guarantees a server-side failure reaches Sentry.
        // Screens catch their own errors to render copy; before this, that
        // was also where the error stopped. See src/lib/error-reporting.ts
        // for what is deliberately filtered out.
        queryCache: new QueryCache({
          onError: (error, query) =>
            reportQueryError(error, { source: 'query', key: query.queryKey }),
        }),
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) =>
            reportQueryError(error, {
              source: 'mutation',
              key: mutation.options.mutationKey,
            }),
        }),
        defaultOptions: {
          queries: {
            staleTime: ONE_MINUTE,
            gcTime: THIRTY_MINUTES,
            placeholderData: keepPreviousData,
            retry: 1,
            // Paired with the focusManager wiring below: stale queries
            // refetch when the app foregrounds, fresh ones don't.
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  // Map app foregrounding to react-query focus so *stale* queries refetch
  // on resume. The previous blanket `queryClient.invalidateQueries()` here
  // refetched every active query on every foreground regardless of
  // staleTime — a network/battery burst duplicated by the scoped
  // foreground listeners in use-badge and use-realtime-subscription,
  // which still force-refresh the counts that must always be live.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') onlineManager.setOnline(true);
      focusManager.setFocused(state === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: TWENTY_FOUR_HOURS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
