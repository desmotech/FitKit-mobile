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

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1_000,
});
