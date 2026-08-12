/**
 * Booking mutations over the real network boundary (MSW): the cache flip a
 * member sees the instant they tap Book/Cancel (before the server answers),
 * the rollback when the server refuses, and the post-settle refetch that
 * reconciles the optimistic guess with server truth.
 *
 * Hook-level: no screens — the cached week list IS what the schedule renders.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { queryKeys } from '@/lib/query-keys';
import { ActiveOrgProvider } from '@/providers/active-org-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import {
  useBookSession,
  useCancelBooking,
  useMyWeekSessions,
  useSelfCheckin,
  type ClassSession,
} from '../use-schedule';
import { useMySubscription, type ApiEnvelope } from '../use-feed-data';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { makeTestQueryClient, TEST_ORG } from '../../../test/render';

const WEEK_START = '2026-07-05';
const WEEK_KEY = queryKeys.sessions.week(TEST_ORG, WEEK_START);
const BOOK_PATH = api(`/organizations/${TEST_ORG}/sessions/:sessionId/book`);
const SUBS_PATH = api(`/organizations/${TEST_ORG}/subscriptions/my`);
const SUBS_KEY = queryKeys.subscriptions.all(TEST_ORG, { mine: true });

/** A minimal subscription payload carrying just the quota field the
 *  Membership card reads — enough to prove a refetch happened. */
function subsPayload(remaining: number) {
  return {
    data: [
      {
        id: 'sub_1',
        status: 'active',
        plan: { name: 'Monthly', type: 'subscription' },
        quotas: [{ period: 'month', limit: 10, used: 10 - remaining, remaining }],
      },
    ],
  };
}

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
    classType: {
      id: 'ct_1',
      name: 'CrossFit',
      color: null,
      defaultDurationMin: 60,
    },
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

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider initialOverride="he">
        <ActiveOrgProvider initialActiveOrgId={TEST_ORG}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ActiveOrgProvider>
      </I18nProvider>
    );
  };
}

function seedWeek(queryClient: QueryClient, sessions: ClassSession[]) {
  queryClient.setQueryData<ApiEnvelope<ClassSession[]>>(WEEK_KEY, {
    data: sessions,
  });
}

/**
 * A response the test releases by hand.
 *
 * These three specs assert `isPending === true` — the whole point is that the
 * cache flips BEFORE the server answers. They used to hold the response with
 * `delay(150)`, which made the in-flight window a race against the test body:
 * when the timer won, the mutation had already settled and `isPending` was
 * false. A gate removes the timing assumption entirely — the server cannot
 * answer until `release()` is called.
 *
 * The gate alone was not enough. `waitFor` on `cachedSession()` reads the
 * query cache DIRECTLY, so it passes the instant `onMutate` writes — while
 * `result.current` is still the pre-mutation render snapshot, making
 * `isPending` false. So the specs now wait on the HOOK (which needs a React
 * re-render) and assert the cache synchronously after; the held response
 * guarantees both are true at the same moment.
 */
function responseGate() {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { held, release: () => release() };
}

function cachedSession(queryClient: QueryClient, id = 'sess_1'): ClassSession {
  const cached =
    queryClient.getQueryData<ApiEnvelope<ClassSession[]>>(WEEK_KEY);
  const found = cached?.data.find((s) => s.id === id);
  if (!found) throw new Error(`session ${id} not in the week cache`);
  return found;
}

describe('useBookSession — optimistic booking on the week list', () => {
  it('marks an open class confirmed (and takes a spot) before the server answers', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [session({ bookingCount: 5, capacityRemaining: 7 })]);
    const gate = responseGate();
    server.use(
      http.post(BOOK_PATH, async () => {
        await gate.held;
        return HttpResponse.json({ data: { status: 'confirmed' } });
      }),
    );

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ sessionId: 'sess_1' });
    });

    // Optimistic: the flip lands while the request is still in flight.
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(cachedSession(queryClient).myBookingStatus).toBe('confirmed');
    expect(cachedSession(queryClient).bookingCount).toBe(6);
    expect(cachedSession(queryClient).capacityRemaining).toBe(6);

    // Let the server answer now that the in-flight assertions have run.
    await act(async () => {
      gate.release();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('marks a full class waitlisted without consuming a class spot', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [
      session({ bookingCount: 12, capacityRemaining: 0 }),
    ]);
    const gate = responseGate();
    server.use(
      http.post(BOOK_PATH, async () => {
        await gate.held;
        return HttpResponse.json({ data: { status: 'waitlisted' } });
      }),
    );

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(cachedSession(queryClient).myBookingStatus).toBe('waitlisted');
    expect(cachedSession(queryClient).bookingCount).toBe(12);
    expect(cachedSession(queryClient).capacityRemaining).toBe(0);

    // Let the server answer now that the in-flight assertions have run.
    await act(async () => {
      gate.release();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls the week list back to the pre-tap snapshot when the server refuses', async () => {
    const queryClient = makeTestQueryClient();
    const before = session({ bookingCount: 5, capacityRemaining: 7 });
    seedWeek(queryClient, [before]);
    server.use(
      http.post(BOOK_PATH, () =>
        HttpResponse.json({ message: 'no credits left' }, { status: 422 }),
      ),
    );

    const { result } = await renderHook(
      () => useBookSession(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedSession(queryClient)).toEqual(before);
    // The server's reason surfaces so the UI can explain the failure.
    expect(result.current.error?.message).toBe('no credits left');
  });

  it('refetches the week after success and reconciles with server truth', async () => {
    const queryClient = makeTestQueryClient();
    // Server truth after booking differs from the optimistic guess (others
    // booked meanwhile) — the settle refetch must win.
    let weekPayload = [session({ bookingCount: 5, capacityRemaining: 7 })];
    server.use(
      http.get(api(`/organizations/${TEST_ORG}/sessions`), () =>
        HttpResponse.json({ data: weekPayload }),
      ),
      http.post(BOOK_PATH, () => {
        weekPayload = [
          session({
            myBookingStatus: 'confirmed',
            bookingCount: 9,
            capacityRemaining: 3,
          }),
        ];
        return HttpResponse.json({ data: { status: 'confirmed' } });
      }),
    );

    const { result } = await renderHook(
      () => ({
        week: useMyWeekSessions(TEST_ORG, WEEK_START),
        book: useBookSession(TEST_ORG, WEEK_START),
      }),
      { wrapper: makeWrapper(queryClient) },
    );

    await waitFor(() =>
      expect(result.current.week.data?.data[0]?.bookingCount).toBe(5),
    );

    await act(async () => {
      result.current.book.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.book.isSuccess).toBe(true));
    await waitFor(() =>
      expect(result.current.week.data?.data[0]?.bookingCount).toBe(9),
    );
    expect(result.current.week.data?.data[0]?.myBookingStatus).toBe(
      'confirmed',
    );
    expect(result.current.week.data?.data[0]?.capacityRemaining).toBe(3);
  });

  it('also refetches the subscriptions quota — a booking consumes a slot the Membership card shows', async () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(SUBS_KEY, subsPayload(5));
    server.use(
      http.get(SUBS_PATH, () => HttpResponse.json(subsPayload(4))),
      http.post(BOOK_PATH, () =>
        HttpResponse.json({ data: { status: 'confirmed' } }),
      ),
    );

    const { result } = await renderHook(
      () => ({
        subs: useMySubscription(TEST_ORG),
        book: useBookSession(TEST_ORG, WEEK_START),
      }),
      { wrapper: makeWrapper(queryClient) },
    );

    expect(result.current.subs.data?.data[0]?.quotas?.[0]?.remaining).toBe(5);

    await act(async () => {
      result.current.book.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.book.isSuccess).toBe(true));
    // Without the fix this stays 5 (stale) until something else refetches it
    // — the exact bug: the count only updated after reopening the app.
    await waitFor(() =>
      expect(result.current.subs.data?.data[0]?.quotas?.[0]?.remaining).toBe(4),
    );
  });
});

describe('useCancelBooking — optimistic cancellation on the week list', () => {
  it('clears my confirmed booking and frees the spot before the server answers', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [
      session({
        myBookingStatus: 'confirmed',
        bookingCount: 6,
        capacityRemaining: 6,
      }),
    ]);
    const gate = responseGate();
    server.use(
      http.delete(BOOK_PATH, async () => {
        await gate.held;
        return HttpResponse.json({ data: { cancelled: true } });
      }),
    );

    const { result } = await renderHook(
      () => useCancelBooking(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(cachedSession(queryClient).myBookingStatus).toBeNull();
    expect(cachedSession(queryClient).bookingCount).toBe(5);
    expect(cachedSession(queryClient).capacityRemaining).toBe(7);

    // Let the server answer now that the in-flight assertions have run.
    await act(async () => {
      gate.release();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('leaves the waitlist without touching class capacity', async () => {
    const queryClient = makeTestQueryClient();
    seedWeek(queryClient, [
      session({
        myBookingStatus: 'waitlisted',
        bookingCount: 12,
        capacityRemaining: 0,
      }),
    ]);
    server.use(
      http.delete(BOOK_PATH, () =>
        HttpResponse.json({ data: { cancelled: true } }),
      ),
    );

    const { result } = await renderHook(
      () => useCancelBooking(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() =>
      expect(cachedSession(queryClient).myBookingStatus).toBeNull(),
    );
    expect(cachedSession(queryClient).bookingCount).toBe(12);
    expect(cachedSession(queryClient).capacityRemaining).toBe(0);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('restores my booking when the server refuses the cancellation', async () => {
    const queryClient = makeTestQueryClient();
    const before = session({
      myBookingStatus: 'confirmed' as const,
      bookingCount: 6,
      capacityRemaining: 6,
    });
    seedWeek(queryClient, [before]);
    server.use(
      http.delete(BOOK_PATH, () =>
        HttpResponse.json({ message: 'window closed' }, { status: 422 }),
      ),
    );

    const { result } = await renderHook(
      () => useCancelBooking(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedSession(queryClient)).toEqual(before);
  });

  it('also refetches the subscriptions quota — cancelling frees a slot the Membership card shows', async () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(SUBS_KEY, subsPayload(4));
    server.use(
      http.get(SUBS_PATH, () => HttpResponse.json(subsPayload(5))),
      http.delete(BOOK_PATH, () =>
        HttpResponse.json({ data: { cancelled: true } }),
      ),
    );

    const { result } = await renderHook(
      () => ({
        subs: useMySubscription(TEST_ORG),
        cancel: useCancelBooking(TEST_ORG, WEEK_START),
      }),
      { wrapper: makeWrapper(queryClient) },
    );

    expect(result.current.subs.data?.data[0]?.quotas?.[0]?.remaining).toBe(4);

    await act(async () => {
      result.current.cancel.mutate({ sessionId: 'sess_1' });
    });

    await waitFor(() => expect(result.current.cancel.isSuccess).toBe(true));
    await waitFor(() =>
      expect(result.current.subs.data?.data[0]?.quotas?.[0]?.remaining).toBe(5),
    );
  });
});

describe('useSelfCheckin — request payload', () => {
  const CHECKIN_PATH = api(
    `/organizations/${TEST_ORG}/sessions/sess_1/self-checkin`,
  );

  it('posts the GPS coordinates with method "gps"', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(CHECKIN_PATH, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { checkedIn: true } });
      }),
    );

    const { result } = await renderHook(
      () => useSelfCheckin(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(makeTestQueryClient()) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        sessionId: 'sess_1',
        body: { method: 'gps', latitude: 32.08, longitude: 34.78 },
      });
    });

    expect(bodies).toEqual([
      { method: 'gps', latitude: 32.08, longitude: 34.78 },
    ]);
  });

  it('posts the QR token and expiry with method "qr"', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(CHECKIN_PATH, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { checkedIn: true } });
      }),
    );

    const { result } = await renderHook(
      () => useSelfCheckin(TEST_ORG, WEEK_START),
      { wrapper: makeWrapper(makeTestQueryClient()) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        sessionId: 'sess_1',
        body: { method: 'qr', token: 'qr-token-1', expiresAt: 1789000000 },
      });
    });

    expect(bodies).toEqual([
      { method: 'qr', token: 'qr-token-1', expiresAt: 1789000000 },
    ]);
  });
});
