/**
 * The offline booking queue (FIT-171).
 *
 * A mutation fired with no connectivity is *paused* by React Query rather
 * than failed (see `src/lib/network.ts` for what makes that true). Paused
 * mutations live in the mutation cache, are written to AsyncStorage alongside
 * the query cache, and are replayed by `queryClient.resumePausedMutations()`
 * once the device is back online — including after a cold start, which is the
 * case that actually matters: a member books in a basement gym, the app is
 * killed on the train, and the booking must still land when they surface.
 *
 * Three things have to be true for that to work, and all three live here:
 *
 *  1. **The mutation must be replayable from its variables alone.** A restored
 *     mutation has no closure — the React tree that created it is long gone.
 *     So `orgId` travels *in* the variables rather than being captured from a
 *     hook, and the request is rebuilt from scratch by the defaults below.
 *
 *  2. **The mutation function must be findable by key.** `setMutationDefaults`
 *     is how a restored mutation, which persisted only its key and its
 *     variables, gets a function to run. It must be registered *before* the
 *     persister restores, which is why `QueryProvider` calls
 *     `registerOfflineMutationDefaults` inside the `useState` initializer that
 *     builds the client, not in an effect.
 *
 *  3. **Only these mutations may be persisted.** The dehydrate default is
 *     "every paused mutation", which would happily write a paused avatar
 *     upload — base64 image and all — into AsyncStorage and replay it days
 *     later against a member who has since changed their photo. The allow-list
 *     is the guard.
 *
 * Deliberately NOT queued: self check-in. A QR token carries an expiry and a
 * GPS fix proves presence at a moment in time, so a check-in replayed twenty
 * minutes later is either rejected by the server or a lie. It fails fast
 * offline instead.
 *
 * The shared outcome handling (analytics, cache reconciliation, refusal
 * notices) is registered on the *defaults* rather than in the calling hooks,
 * because a restored mutation has no hook — the defaults are the only options
 * it will ever see. Per-call callbacks passed to `mutate(vars, { … })` still
 * run in addition to these, so screens keep their own success/error handling.
 */
import type { Mutation, MutationKey, QueryClient } from '@tanstack/react-query';
import { analytics } from '@/lib/analytics';
import { reportHandledError } from '@/lib/error-reporting';
import { recordSyncFailure } from '@/lib/offline-sync-store';
import { queryKeys } from '@/lib/query-keys';

/** `(path, init) => json` — `fetchWithAuth` from `use-api`, read late. */
export type AuthedFetch = (
  path: string,
  init?: RequestInit,
) => Promise<unknown>;

// ── Variables ────────────────────────────────────────────────────────
// Self-contained by contract: everything needed to rebuild the request,
// nothing that only makes sense inside the tree that created it.

export interface BookSessionVars {
  orgId: string;
  sessionId: string;
  /** Which plan pays. Omitted when the org runs no plans (free-gym model). */
  subscriptionId?: string;
}

export interface CancelBookingVars {
  orgId: string;
  sessionId: string;
}

// ── Keys ─────────────────────────────────────────────────────────────

export const offlineMutationKeys = {
  bookSession: ['sessions', 'book'] as const,
  cancelBooking: ['sessions', 'cancel'] as const,
} as const;

const QUEUEABLE_KEYS: readonly string[] = [
  JSON.stringify(offlineMutationKeys.bookSession),
  JSON.stringify(offlineMutationKeys.cancelBooking),
];

/** Whether a mutation key is one the queue owns (and may persist). */
export function isQueueableMutationKey(key: MutationKey | undefined): boolean {
  if (!key) return false;
  try {
    return QUEUEABLE_KEYS.includes(JSON.stringify(key));
  } catch {
    return false;
  }
}

/**
 * `persistOptions.dehydrateOptions.shouldDehydrateMutation`.
 *
 * Paused *and* allow-listed. The pause check matters as much as the
 * allow-list: a booking that is merely in flight when the app is killed must
 * not be written to disk, because we cannot know whether the server received
 * it — replaying it on next launch would risk a double-book. Only a mutation
 * that provably never left the device is safe to keep.
 */
export function shouldPersistMutation(mutation: Mutation): boolean {
  return (
    mutation.state.isPaused &&
    isQueueableMutationKey(mutation.options.mutationKey)
  );
}

// ── Cache reconciliation ─────────────────────────────────────────────

/** Prefix covering both the week lists and the single-session detail. */
function sessionsPrefix(orgId: string): readonly unknown[] {
  return ['/organizations', orgId, 'sessions'];
}

/** Only the fields reconciliation reads — kept structural so this module
 *  stays free of a runtime dependency on the schedule hooks. */
type CachedSession = { id: string; myBookingStatus: string | null };

/**
 * The member's booking status for a session as the *cache* currently sees it,
 * or `undefined` when no cached response mentions the session at all.
 *
 * Reads across every cached shape under the org's session prefix: the week
 * lists hold arrays, the detail query a single object.
 */
export function cachedBookingStatus(
  queryClient: QueryClient,
  orgId: string,
  sessionId: string,
): string | null | undefined {
  const entries = queryClient.getQueriesData<{
    data: CachedSession | CachedSession[];
  }>({ queryKey: sessionsPrefix(orgId) });

  for (const [, value] of entries) {
    const payload = value?.data;
    if (!payload) continue;
    const list = Array.isArray(payload) ? payload : [payload];
    const hit = list.find((s) => s?.id === sessionId);
    if (hit) return hit.myBookingStatus;
  }
  return undefined;
}

/**
 * Context handed back by the calling hook's `onMutate`.
 *
 * `queuedOffline` is how the shared outcome handler tells a *replay* from a
 * live tap, and the distinction decides who reports the failure. A booking
 * that fails while the member is looking at the screen is already alerted
 * there — raising a banner for it too would double-report. A booking that
 * fails on replay has no screen, which is the entire reason the banner
 * exists.
 *
 * `undefined` context means the mutation was restored from disk on a cold
 * start: no hook ran, so no `onMutate` ran. That is a replay by definition.
 */
export interface QueuedMutationContext {
  queuedOffline?: boolean;
}

function isReplay(context: unknown): boolean {
  if (context == null) return true;
  return (context as QueuedMutationContext).queuedOffline === true;
}

/**
 * Decide what a failed replay actually means, and tell the member only when
 * it means something.
 *
 * A queued mutation can fail harmlessly: the request reached the server but
 * its response was lost mid-flight, so the retry is answered `400 Already
 * booked for this session` — or `404` for a cancellation whose booking is
 * already gone. It can also fail for real: the class filled up, credits ran
 * out, the cancellation window closed. Both arrive as a bare 4xx. The API
 * emits no structured `code` on either path today, and matching its English
 * prose from an `X-Locale: he` client would be a bug waiting to happen.
 *
 * So this does not classify the error at all. It re-reads the session from
 * the server and asks whether the member's *intent* is now satisfied — the
 * same question by a route that cannot be fooled by wording.
 *
 * It re-reads over the wire rather than refetching the cached week query,
 * because at replay time there may be no React tree at all. A query restored
 * from the persister carries its data but not its `queryFn` — that arrives
 * with the component that mounts it — so asking react-query to refetch on a
 * cold start refetches nothing, and the judgement would be made against the
 * stale cache it was supposed to be checking.
 *
 * (Worth a follow-up on the API: emitting `already_booked` /
 * `booking_not_found` codes would settle this without the extra GET.)
 */
async function reconcileFailedReplay(
  queryClient: QueryClient,
  getFetch: () => AuthedFetch,
  kind: 'book' | 'cancel',
  vars: BookSessionVars | CancelBookingVars,
  error: unknown,
): Promise<void> {
  const status = await serverBookingStatus(queryClient, getFetch, vars);

  // `undefined` means we could not establish the truth — the session read
  // failed too (still flaky), or it no longer exists. Report rather than
  // swallow: a change the member believes they made deserves to be doubted
  // out loud, and a false alarm costs them a glance at the schedule.
  const satisfied =
    status === undefined
      ? false
      : kind === 'book'
        ? status !== null
        : status === null;
  if (satisfied) return;

  recordSyncFailure({
    sessionId: vars.sessionId,
    kind,
    reason: error instanceof Error ? error.message : undefined,
  });

  // The mutation cache's own reporter drops 4xx as "the UI already renders
  // it" — true for a live tap, false here: there may be no screen at all.
  reportHandledError(error, {
    feature: 'offline-sync',
    extra: { kind, sessionId: vars.sessionId },
  });
}

/**
 * The member's booking status for a session, straight from the API, seeded
 * back into the cache so any screen that IS mounted lands on truth too.
 *
 * Falls back to whatever the cache already holds when the read fails, and to
 * `undefined` when neither can answer.
 */
async function serverBookingStatus(
  queryClient: QueryClient,
  getFetch: () => AuthedFetch,
  vars: BookSessionVars | CancelBookingVars,
): Promise<string | null | undefined> {
  try {
    const response = (await getFetch()(
      `/organizations/${vars.orgId}/sessions/${vars.sessionId}`,
    )) as { data?: CachedSession } | undefined;
    const session = response?.data;
    if (session) {
      queryClient.setQueryData(
        queryKeys.sessions.byId(vars.orgId, vars.sessionId),
        response,
      );
      return session.myBookingStatus;
    }
  } catch {
    // Fall through to the cache.
  }
  return cachedBookingStatus(queryClient, vars.orgId, vars.sessionId);
}

// ── Replay ───────────────────────────────────────────────────────────

function bookPath(orgId: string, sessionId: string): string {
  return `/organizations/${orgId}/sessions/${sessionId}/book`;
}

/**
 * Invalidate everything a booking moves, so any mounted screen refetches.
 * Awaited so a caller can rely on the refresh having been kicked off.
 */
async function refreshAfterBooking(
  queryClient: QueryClient,
  orgId: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: sessionsPrefix(orgId) });
  // A booking consumes quota — the Membership card's "X of Y used" reads off
  // this query, or it is stuck showing pre-booking numbers until something
  // else happens to refetch it.
  await queryClient.invalidateQueries({
    queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
  });
}

/**
 * Teaches the client how to replay each queued mutation, and what to do with
 * the outcome.
 *
 * `getFetch` is a getter, not the function itself: `fetchWithAuth` closes over
 * Clerk's `getToken` and gets a fresh identity on every render, so capturing
 * one here would pin the queue to whatever token helper existed when the
 * provider first mounted. Reading it late means a mutation resumed an hour
 * after it was queued mints a *current* JWT.
 */
export function registerOfflineMutationDefaults(
  queryClient: QueryClient,
  getFetch: () => AuthedFetch,
): void {
  queryClient.setMutationDefaults(offlineMutationKeys.bookSession, {
    // Opts back into pausing, against the app-wide `'always'` default. This
    // one line is what makes the mutation queue rather than fail.
    networkMode: 'online',
    mutationFn: (vars: BookSessionVars) =>
      getFetch()(bookPath(vars.orgId, vars.sessionId), {
        method: 'POST',
        body: JSON.stringify(
          vars.subscriptionId ? { subscriptionId: vars.subscriptionId } : {},
        ),
      }),
    onSuccess: (_data, vars: BookSessionVars) => {
      analytics.track('member_booking_created', {
        org_id: vars.orgId,
        session_id: vars.sessionId,
        platform: 'mobile',
      });
    },
    onSettled: async (_data, error, vars: BookSessionVars, context) => {
      await refreshAfterBooking(queryClient, vars.orgId);
      if (error && isReplay(context)) {
        await reconcileFailedReplay(queryClient, getFetch, 'book', vars, error);
      }
    },
  });

  queryClient.setMutationDefaults(offlineMutationKeys.cancelBooking, {
    networkMode: 'online',
    mutationFn: (vars: CancelBookingVars) =>
      getFetch()(bookPath(vars.orgId, vars.sessionId), { method: 'DELETE' }),
    onSuccess: (_data, vars: CancelBookingVars) => {
      analytics.track('member_booking_cancelled', {
        org_id: vars.orgId,
        session_id: vars.sessionId,
        platform: 'mobile',
      });
    },
    onSettled: async (_data, error, vars: CancelBookingVars, context) => {
      await refreshAfterBooking(queryClient, vars.orgId);
      if (error && isReplay(context)) {
        await reconcileFailedReplay(queryClient, getFetch, 'cancel', vars, error);
      }
    },
  });
}
