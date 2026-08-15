/**
 * The single AsyncStorage-backed React Query persister.
 *
 * Lives in its own module (rather than inside `query-provider.tsx`) because
 * two callers need the *same* instance: the provider that persists/restores
 * the cache, and the session reset that has to erase it when the signed-in
 * identity changes. Reaching for `AsyncStorage.removeItem('fitkit-rq-cache')`
 * by hand instead is what let a signed-out user's cache survive — the
 * persister's own throttled write lands after the manual delete and puts the
 * blob straight back.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUERY_CACHE_KEY = 'fitkit-rq-cache';

/**
 * `gcTime` for the handful of queries a member must be able to read with no
 * signal: this week's classes and this week's programmed workouts (FIT-171).
 *
 * Only a query still in the cache is written to the persisted snapshot, so
 * `gcTime` — not the persister's `maxAge` — is what actually decides how long
 * "cached for offline viewing" lasts. At the app-wide 30 minutes it meant
 * half an hour: a member who checked the schedule at breakfast and opened the
 * app again on the gym floor at lunch got skeletons and an empty state.
 *
 * Applied per hook rather than globally on purpose — see the note on
 * `defaultOptions.queries.gcTime` in query-provider.tsx.
 */
export const OFFLINE_GC_TIME = 24 * 60 * 60_000;

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1_000,
});
