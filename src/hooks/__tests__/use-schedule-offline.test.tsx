/**
 * The offline booking queue end to end (FIT-171).
 *
 * These specs drive `onlineManager` directly rather than simulating a NetInfo
 * interface: the manager is the boundary the app actually reads, and binding
 * it to NetInfo is tested separately in src/lib/__tests__/network.test.ts.
 *
 * What matters here is the promise the queue makes to a member standing in a
 * basement gym: the tap is remembered, it is NOT presented as a confirmed
 * booking, and it reaches the server the moment there is a network.
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { queryKeys } from '@/lib/query-keys';
import {
  registerOfflineMutationDefaults,
  shouldPersistMutation,
} from '@/lib/offline-queue';
import {
  clearSyncFailures,
  getSyncFailures,
} from '@/lib/offline-sync-store';
import { ActiveOrgProvider } from '@/providers/active-org-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import { useApi } from '../use-api';
import {
  canQueueCancellation,
  useBookSession,
  useCancelBooking,
  type ClassSession,
} from '../use-schedule';
import { useQueuedBookings } from '../use-offline';
import type { ApiEnvelope } from '../use-feed-data';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { makeTestQueryClient, TEST_ORG } from '../../../test/render';

const WEEK_START = '2026-07-05';
const WEEK_KEY = queryKeys.sessions.week(TEST_ORG, WEEK_START);
const BOOK_PATH = api(`/organizations/${TEST_ORG}/sessions/:sessionId/book`);
const SESSION_PATH = api(`/organizations/${TEST_ORG}/sessions/:sessionId`);

function session(overrides: Partial<ClassSession> = {}): ClassSession {
  return {
    id: 'sess_1',
    classTypeId: 'ct_1',
    title: null,
    startsAt: '2026-07-06T08:00:00.000Z',
    endsAt: '2026-07-06T09:00:00.000Z',
    capacity: 12,
    waitlistCapacity: 3,
    status: 'published',
    notes: null,
    classType: { id: 'ct_1', name: 'CrossFit', color: null, defaultDurationMin: 60 },
    location: null,
    coach: null,
    workouts: [],
    attendees: [],
    bookingCount: 5,
    capacityRemaining: 7,
    myBookingStatus: null,
    myCheckedInAt: null,
    myCheckinMethod: null,
    cancellationDeadline: null,
    cancellationWindowHours: 0,
    allowLateCancellation: false,
    ...overrides,
  };
}

function OfflineDefaults({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  const { fetchWithAuth } = useApi();
  const fetchRef = useRef(fetchWithAuth);
  fetchRef.current = fetchWithAuth;
  useState(() => {
    registerOfflineMutationDefaults(queryClient, () => fetchRef.current);
    return true;
  });
  return <>{children}</>;
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider initialOverride="he">
        <ActiveOrgProvider initialActiveOrgId={TEST_ORG}>
          <QueryClientProvider client={queryClient}>
            <OfflineDefaults queryClient={queryClient}>
              {children}
            </OfflineDefaults>
          </QueryClientProvider>
        </ActiveOrgProvider>
      </I18nProvider>
    );
  };
}

/** A response the test releases by hand, so "in flight" is not a race against
 *  the test body. */
function responseGate() {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { held, release: () => release() };
}

function seedWeek(queryClient: QueryClient, sessions: ClassSession[]) {
  queryClient.setQueryData<ApiEnvelope<ClassSession[]>>(WEEK_KEY, {
    data: sessions,
  });
}

function cachedSession(queryClient: QueryClient, id = 'sess_1'): ClassSession {
  const cached =
    queryClient.getQueryData<ApiEnvelope<ClassSession[]>>(WEEK_KEY);
  const found = cached?.data.find((s) => s.id === id);
  if (!found) throw new Error(`session ${id} not in the week cache`);
  return found;
}

// The manager is a module-level singleton, so a spec that leaves it offline
// would take every later suite down with it.
afterEach(() => {
  onlineManager.setOnline(true);
  clearSyncFailures();
});

describe('booking offline', () => {
  it('holds the booking instead of failing it', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });

    // Paused, not errored. Before the onlineManager was bound to the OS this
    // fired at a dead socket and rolled its own optimistic update back.
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    expect(result.current.isError).toBe(false);
  });

  it('does NOT claim the class is booked', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session({ bookingCount: 5, capacityRemaining: 7 })]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));

    // The online path flips this to 'confirmed' optimistically. Offline it
    // must not: capacity is the server's call and the class can fill while
    // the member is underground. "Booked" here would be a promise the app
    // cannot keep — the row shows a queued stamp instead.
    expect(cachedSession(queryClient).myBookingStatus).toBeNull();
    expect(cachedSession(queryClient).capacityRemaining).toBe(7);
  });

  it('surfaces the held booking as a queued change for the UI to stamp', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => ({
        book: useBookSession(TEST_ORG, WEEK_START),
        queued: useQueuedBookings(),
      }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.book.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.queued).toHaveLength(1));
    expect(result.current.queued[0]).toEqual({
      sessionId: 'sess_1',
      kind: 'book',
      waiting: true,
    });
  });

  it('does not count an ordinary online booking as queued work', async () => {
    // `status: 'pending'` is equally true of a normal in-flight request, so
    // counting it flashed "Syncing your changes…" across the screen on every
    // tap and stamped the row "Will book" while its own button spinner was
    // already saying so. Only genuinely queued work belongs here.
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    const gate = responseGate();
    server.use(
      http.post(BOOK_PATH, async () => {
        await gate.held;
        return HttpResponse.json({ data: { status: 'confirmed' } });
      }),
    );

    const { result } = await renderHook(
      () => ({
        book: useBookSession(TEST_ORG, WEEK_START),
        queued: useQueuedBookings(),
      }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.book.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });

    // In flight, online: the request is pending and the optimistic flip has
    // landed, but nothing is queued.
    await waitFor(() => expect(result.current.book.isPending).toBe(true));
    expect(cachedSession(queryClient).myBookingStatus).toBe('confirmed');
    expect(result.current.queued).toEqual([]);

    await act(async () => {
      gate.release();
    });
    await waitFor(() => expect(result.current.book.isSuccess).toBe(true));
    expect(result.current.queued).toEqual([]);
  });

  it('is eligible for persistence, so it survives an app kill', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));

    const [mutation] = queryClient.getMutationCache().getAll();
    expect(shouldPersistMutation(mutation)).toBe(true);
    // Everything needed to rebuild the request without a closure — this is
    // what a mutation restored on a cold start has to work from.
    expect(mutation.state.variables).toEqual({
      orgId: TEST_ORG,
      sessionId: 'sess_1',
    });
  });

  it('sends the booking when the network comes back', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    const posted: string[] = [];
    server.use(
      http.post(BOOK_PATH, ({ params }) => {
        posted.push(String(params.sessionId));
        return HttpResponse.json({ data: { status: 'confirmed' } });
      }),
    );
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    expect(posted).toEqual([]);

    // Back in signal.
    await act(async () => {
      onlineManager.setOnline(true);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(posted).toEqual(['sess_1']);
  });

  it('carries the chosen plan through the queue', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    const bodies: unknown[] = [];
    server.use(
      http.post(BOOK_PATH, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { status: 'confirmed' } });
      }),
    );
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({
        orgId: TEST_ORG,
        sessionId: 'sess_1',
        subscriptionId: 'sub_9',
      });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Multi-plan members pick explicitly; the replay must spend the plan they
    // chose, not whichever one the server would auto-pick an hour later.
    expect(bodies).toEqual([{ subscriptionId: 'sub_9' }]);
  });
});

describe('a refused replay', () => {
  it('stays quiet when the server and the member already agree', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    server.use(
      // The classic benign duplicate: the request landed before the app died,
      // so the replay is refused — but the booking exists.
      http.post(BOOK_PATH, () =>
        HttpResponse.json(
          { message: 'Already booked for this session' },
          { status: 400 },
        ),
      ),
      // The reconciliation's authoritative re-read: the booking is there.
      http.get(SESSION_PATH, () =>
        HttpResponse.json({ data: session({ myBookingStatus: 'confirmed' }) }),
      ),
    );
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The member asked to be booked and they are booked. Telling them
    // something "didn't go through" would be noise about an outcome they
    // already have — and the API sends no code to distinguish this from a
    // real refusal, so the reconciliation re-reads the session instead.
    await waitFor(() =>
      expect(
        queryClient.getQueryData<ApiEnvelope<ClassSession>>(
          queryKeys.sessions.byId(TEST_ORG, 'sess_1'),
        )?.data.myBookingStatus,
      ).toBe('confirmed'),
    );
    expect(getSyncFailures()).toEqual([]);
  });

  it('reports a real refusal, because there is no screen to alert', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    server.use(
      http.post(BOOK_PATH, () =>
        HttpResponse.json({ message: 'Session is full' }, { status: 400 }),
      ),
      http.get(SESSION_PATH, () =>
        HttpResponse.json({ data: session({ capacityRemaining: 0 }) }),
      ),
    );
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The class filled while they were underground. They are walking to a gym
    // expecting a spot, and the replay may have finished during a cold start
    // with nothing on screen — so it has to reach the banner.
    await waitFor(() =>
      expect(getSyncFailures()).toEqual([
        { sessionId: 'sess_1', kind: 'book', reason: 'Session is full' },
      ]),
    );
  });

  it('does not fire for a failure the member watched happen', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session()]);
    server.use(
      http.post(BOOK_PATH, () =>
        HttpResponse.json({ message: 'no credits left' }, { status: 422 }),
      ),
      http.get(SESSION_PATH, () => HttpResponse.json({ data: session() })),
    );

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    // Online the whole time: the screen alerts this itself. A banner too
    // would be the same refusal reported twice.
    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getSyncFailures()).toEqual([]);
  });
});

describe('cancelling offline', () => {
  it('replays the cancellation when the network comes back', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session({ myBookingStatus: 'confirmed' })]);
    const deleted: string[] = [];
    server.use(
      http.delete(BOOK_PATH, ({ params }) => {
        deleted.push(String(params.sessionId));
        return HttpResponse.json({ data: { cancelled: true } });
      }),
    );
    onlineManager.setOnline(false);

    const { result } = await renderHook(
      () => useCancelBooking(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ orgId: TEST_ORG, sessionId: 'sess_1' });
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    // Still booked until the server says otherwise.
    expect(cachedSession(queryClient).myBookingStatus).toBe('confirmed');

    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleted).toEqual(['sess_1']);
  });
});

describe('canQueueCancellation', () => {
  const NOW = Date.parse('2026-07-06T08:00:00.000Z');
  const hoursFromNow = (h: number) =>
    new Date(NOW + h * 3_600_000).toISOString();

  it('allows a cancellation whose window is comfortably open', () => {
    expect(
      canQueueCancellation(
        session({ cancellationDeadline: hoursFromNow(6) }),
        NOW,
      ),
    ).toBe(true);
  });

  it('refuses one whose window closes inside the offline horizon', () => {
    // Queueing this would leave the member believing they are off the list
    // while the replay gets refused for being late.
    expect(
      canQueueCancellation(
        session({ cancellationDeadline: hoursFromNow(0.5) }),
        NOW,
      ),
    ).toBe(false);
  });

  it('allows it anyway when the org permits late cancellation', () => {
    expect(
      canQueueCancellation(
        session({
          cancellationDeadline: hoursFromNow(0.5),
          allowLateCancellation: true,
        }),
        NOW,
      ),
    ).toBe(true);
  });

  it('allows it when there is no deadline at all', () => {
    expect(
      canQueueCancellation(session({ cancellationDeadline: null }), NOW),
    ).toBe(true);
  });
});
