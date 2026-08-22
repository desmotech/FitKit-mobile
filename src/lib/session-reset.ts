/**
 * Session-scoped local state: who the cache on this device belongs to, and
 * how to erase it.
 *
 * The React Query cache is persisted to AsyncStorage and restored on every
 * cold start, so without an owner stamp it outlives the session that filled
 * it: sign out, sign in as someone else, and the restored blob renders the
 * *previous* member's name, stats and messages until every query refetches.
 * The active-org selection has the same lifetime problem.
 *
 * `SessionGuard` compares the stamp to Clerk's current user id and calls
 * `resetClientSession` whenever they diverge (sign-out, account switch,
 * revoked/expired session), so no single sign-out button has to remember.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { queryPersister } from '@/lib/query-persister';
import { clearSyncFailures } from '@/lib/offline-sync-store';
import { clearActiveOrgId } from '@/lib/settings-store';

const SESSION_OWNER_KEY = 'taikan:auth:cacheOwner';

/** Clerk user id the persisted cache was written for, or null. */
export async function loadSessionOwner(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_OWNER_KEY);
  } catch {
    return null;
  }
}

export async function saveSessionOwner(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_OWNER_KEY, userId);
  } catch {
    // Non-fatal: a missing stamp reads as "unknown owner", which only costs
    // an extra reset on the next identity change.
  }
}

export async function clearSessionOwner(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_OWNER_KEY);
  } catch {
    // Non-fatal — see saveSessionOwner.
  }
}

/**
 * Drops every trace of the previous session's server data from this device:
 * the in-memory query cache, the persisted copy of it, the active-org
 * selection, and the owner stamp.
 *
 * Call this AFTER Clerk has dropped the session. `useApiQuery` gates every
 * query on `isSignedIn`, so clearing post-sign-out leaves the observers
 * disabled and nothing refetches; clearing while the session is still live
 * makes mounted screens refetch with the outgoing user's token and re-persist
 * exactly what we just deleted.
 */
export async function resetClientSession(queryClient: QueryClient): Promise<void> {
  // `clear()` empties the mutation cache as well as the query cache, which is
  // what drops any booking the outgoing member had queued offline (FIT-171).
  // That is deliberate: a queued booking is an instruction to spend *their*
  // credits, and replaying it under whoever signs in next would book the
  // wrong person into a class on the wrong plan.
  queryClient.clear();
  clearSyncFailures();
  await Promise.all([
    queryPersister.removeClient(),
    clearActiveOrgId(),
    clearSessionOwner(),
  ]);
}
