import {
  MutationCache,
  QueryCache,
  QueryClient,
  focusManager,
  keepPreviousData,
} from '@tanstack/react-query';
import { reportQueryError } from '@/lib/error-reporting';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister } from '@/lib/query-persister';
import { refreshNetworkState, startNetworkWatcher } from '@/lib/network';
import {
  registerOfflineMutationDefaults,
  shouldPersistMutation,
} from '@/lib/offline-queue';
import { useApi } from '@/hooks/use-api';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const ONE_MINUTE = 60_000;
const THIRTY_MINUTES = 30 * ONE_MINUTE;
const TWENTY_FOUR_HOURS = 24 * 60 * ONE_MINUTE;

export function QueryProvider({ children }: { children: ReactNode }) {
  // Bind react-query's onlineManager to the OS before the client is built, so
  // the very first render already knows whether there is a network. Idempotent.
  startNetworkWatcher();

  const { fetchWithAuth } = useApi();
  // `fetchWithAuth` is a fresh identity on every render (it closes over
  // Clerk's `getToken`), so the offline queue reads it through a ref instead
  // of capturing one. A booking resumed an hour after it was queued then
  // mints a current token rather than replaying a long-expired one.
  const fetchRef = useRef(fetchWithAuth);
  fetchRef.current = fetchWithAuth;

  const [queryClient] = useState(() => {
    const client = new QueryClient({
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
          // Stays 30 minutes for most queries. Only what a member genuinely
          // needs to read with no signal — the schedule and the week's
          // workouts — opts into `OFFLINE_GC_TIME` at its own hook. Raising
          // this globally would have been the shorter change, but the cache
          // is persisted wholesale into AsyncStorage, whose Android store is
          // ~6MB by default: keeping a day of every message thread, shop
          // catalogue and photo list alive to make the schedule readable is
          // how that budget gets spent on the wrong thing.
          gcTime: THIRTY_MINUTES,
          placeholderData: keepPreviousData,
          retry: 1,
          // Paired with the focusManager wiring below: stale queries
          // refetch when the app foregrounds, fresh ones don't.
          refetchOnWindowFocus: true,
        },
        mutations: {
          // Queuing is opt-in, per mutation key, and today only the two
          // booking mutations opt in (see offline-queue.ts).
          //
          // React Query's default — `networkMode: 'online'` — would pause
          // EVERY mutation the moment connectivity dropped: a paused mutation
          // stays `isPending` forever and fires no callback, so every screen
          // that spins on `isPending` and clears in `onSettled` (log a result,
          // send a message, upload a photo) would hang on a spinner with no
          // error and no way back. Failing fast is the honest default for a
          // mutation nothing is going to replay.
          networkMode: 'always',
        },
      },
    });

    // Must happen here, not in an effect: a mutation restored from disk
    // carries only its key and its variables, and looks its function up in
    // the defaults. The persister's restore is async but starts on mount, so
    // registering during the client's construction is what guarantees the
    // defaults exist before the first queued booking is rehydrated.
    registerOfflineMutationDefaults(client, () => fetchRef.current);

    return client;
  });

  // Map app foregrounding to react-query focus so *stale* queries refetch
  // on resume. The previous blanket `queryClient.invalidateQueries()` here
  // refetched every active query on every foreground regardless of
  // staleTime — a network/battery burst duplicated by the scoped
  // foreground listeners in use-badge and use-realtime-subscription,
  // which still force-refresh the counts that must always be live.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      // Ask the OS rather than assert. This line used to be
      // `onlineManager.setOnline(true)`, which declared the app online every
      // time it was opened — including when it was opened *because* the
      // member had walked into a dead spot and wanted to know why.
      if (state === 'active') refreshNetworkState();
      focusManager.setFocused(state === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        // Whole-snapshot expiry: open the app after longer than this and the
        // restore is discarded outright, queued bookings included. That is
        // the intended outcome — a booking intent a day stale is for a class
        // that has most likely already happened, and replaying it then is
        // worse than dropping it.
        maxAge: TWENTY_FOUR_HOURS,
        dehydrateOptions: {
          // Default is "every paused mutation", which would write a paused
          // avatar upload — base64 payload and all — to AsyncStorage and
          // replay it days later. See src/lib/offline-queue.ts.
          shouldDehydrateMutation: shouldPersistMutation,
        },
      }}
      onSuccess={() => {
        // Restore finished: anything queued on a previous run is now in the
        // mutation cache. Resume replays it as soon as the device is online
        // (the resume itself no-ops while offline and re-pauses).
        void queryClient.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
