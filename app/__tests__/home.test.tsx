/**
 * Home dashboard — the member's landing screen. These tests pin the four
 * member-visible "Today" states: an assigned workout renders its name, an
 * assigned rest day shows the rest copy (never the open-day nudge), a failed
 * read shows the error card (never a misleading rest/open state), and staged
 * goals render their titles.
 *
 * Network staged via MSW; the real hooks, week math, and screen logic run.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../(tabs)/index';
import { homeStringsFor } from '@/i18n/home-strings';
import { getWeekStartDay, weekStartFor, ymd } from '@/lib/week';
import {
  membership,
  stageSignedInMember,
  subscriptionWithPlan,
  userMe,
} from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const H = homeStringsFor('he');

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: mockPush,
      back: jest.fn(),
      replace: jest.fn(),
    }),
    // The screen re-checks "today" on focus; under test the screen is
    // always focused, so run the callback as a plain effect.
    useFocusEffect: (cb: () => void) => {
      useEffect(cb, [cb]);
    },
  };
});

// The weekStart the app derives for the Hebrew locale (Sunday-anchored),
// computed with the same lib functions the screen uses.
const WEEK_START = weekStartFor(new Date(), getWeekStartDay('he'));
const TODAY = ymd(new Date());

function todayWorkoutAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asg_1',
    date: TODAY,
    published: true,
    status: 'assigned',
    kind: 'workout',
    workout: {
      id: 'w_1',
      title: 'Fran',
      displayName: 'Fran',
      description: null,
      scoring: 'time',
      mode: 'fixed',
      timeCap: null,
      sortOrder: 0,
      sections: [],
    },
    ...overrides,
  };
}

/** A published class today at 18:00 local, with no workout attached. */
function todaySession(overrides: Record<string, unknown> = {}) {
  const startsAt = new Date();
  startsAt.setHours(18, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  return {
    id: 'sess_1',
    classTypeId: 'ct_1',
    title: null,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    capacity: 12,
    waitlistCapacity: 0,
    status: 'published',
    notes: null,
    classType: { id: 'ct_1', name: 'Yoga', color: null, defaultDurationMin: 60 },
    location: null,
    coach: null,
    workouts: [],
    attendees: [],
    bookingCount: 0,
    capacityRemaining: 12,
    myBookingStatus: null,
    myCheckedInAt: null,
    myCheckinMethod: null,
    cancellationDeadline: null,
    cancellationWindowHours: 2,
    allowLateCancellation: false,
    ...overrides,
  };
}

function goal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal_1',
    type: 'exercise_pr',
    status: 'active',
    exerciseId: 'ex_1',
    exerciseName: 'Back Squat',
    metricType: null,
    currentValue: 90,
    targetValue: 120,
    unit: 'kg',
    progressPercent: 75,
    ...overrides,
  };
}

/** Stage every read the dashboard + member header perform. */
function stageHome({
  assignments = [] as Record<string, unknown>[],
  goals = [] as Record<string, unknown>[],
  sessions = [] as Record<string, unknown>[],
  subscriptions = [] as Record<string, unknown>[],
}: {
  assignments?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  sessions?: Record<string, unknown>[];
  subscriptions?: Record<string, unknown>[];
} = {}) {
  const requestedWeekStarts: (string | null)[] = [];
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: subscriptions }),
    ),
    http.get(
      api(`/organizations/${TEST_ORG}/assignments/my-week`),
      ({ request }) => {
        requestedWeekStarts.push(
          new URL(request.url).searchParams.get('weekStart'),
        );
        return HttpResponse.json({ data: assignments });
      },
    ),
    http.get(api(`/organizations/${TEST_ORG}/sessions`), () =>
      HttpResponse.json({ data: sessions }),
    ),
    // The peek sheet re-reads the session, because the week list is not
    // guaranteed to carry each workout's sections.
    http.get(api(`/organizations/${TEST_ORG}/sessions/:id`), ({ params }) =>
      HttpResponse.json({
        data: sessions.find((s) => (s as { id: string }).id === params.id),
      }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/goals/me`), () =>
      HttpResponse.json({ data: goals }),
    ),
    // Member header chrome (unified inbox unread badge).
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
  );
  return { requestedWeekStarts };
}

beforeEach(() => {
  mockPush.mockClear();
  stageSignedInMember();
});

describe('Home dashboard — Today section', () => {
  it("shows today's assigned workout by name, fetched for the he-locale week", async () => {
    const { requestedWeekStarts } = stageHome({
      assignments: [todayWorkoutAssignment()],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Fran')).toBeOnTheScreen();
    // The week query must be anchored the way the app anchors it for
    // Hebrew (Sunday) — a Monday-anchored request would miss Sunday's WOD.
    expect(requestedWeekStarts).toContain(WEEK_START);
    // A day with a workout is neither rest nor open.
    expect(screen.queryByText(H.restDayTitle)).not.toBeOnTheScreen();
    expect(screen.queryByText(H.openDayTitle)).not.toBeOnTheScreen();
  });

  it('shows the rest-day copy when the coach assigned rest — not the open-day nudge', async () => {
    stageHome({
      assignments: [
        todayWorkoutAssignment({ kind: 'rest', workout: null }),
      ],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(H.restDayTitle)).toBeOnTheScreen();
    expect(screen.getByText(H.restDaySubtitle)).toBeOnTheScreen();
    expect(screen.queryByText(H.openDayTitle)).not.toBeOnTheScreen();
  });

  // Extended jest timeout: the retry backoff (see below) runs on real timers.
  it('shows the error card when the today queries fail — never rest/open copy', async () => {
    stageHome(); // header + goals succeed…
    server.use(
      // …but both today reads 500.
      http.get(api(`/organizations/${TEST_ORG}/assignments/my-week`), () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
      http.get(api(`/organizations/${TEST_ORG}/sessions`), () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await renderWithProviders(<HomeScreen />);

    // useApiQuery hardcodes up to 3 attempts with backoff for non-401
    // errors (overriding the test client's retry: false), so the error
    // card appears only after ~3s of real-timer backoff.
    expect(
      await screen.findByText(H.loadFailedTitle, {}, { timeout: 8000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText(H.loadFailedSubtitle)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: H.tryAgain }),
    ).toBeOnTheScreen();
    // A network failure must never masquerade as "no workout today".
    expect(screen.queryByText(H.openDayTitle)).not.toBeOnTheScreen();
    expect(screen.queryByText(H.restDayTitle)).not.toBeOnTheScreen();
  }, 15000);
});

describe('Home dashboard — Goals section', () => {
  it('renders the active goals by title', async () => {
    stageHome({
      goals: [
        goal({ id: 'goal_1', exerciseName: 'Back Squat', progressPercent: 75 }),
        goal({ id: 'goal_2', exerciseName: 'Deadlift', progressPercent: 40 }),
      ],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Back Squat')).toBeOnTheScreen();
    expect(screen.getByText('Deadlift')).toBeOnTheScreen();
  });

  // The section used to answer an empty goal list with a "set your first
  // goal" card — a second Add goal CTA one scroll below the Quick actions
  // tile. The tile is the one that stayed, so an empty list now means no
  // section at all rather than a heading over a nudge.
  it('drops the whole section when no goal is active', async () => {
    stageHome({
      goals: [goal({ status: 'archived' })],
    });

    await renderWithProviders(<HomeScreen />);

    // Quick actions still offers the one Add goal there is.
    expect(await screen.findByText(H.addGoal)).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByText(H.goalsTitle)).not.toBeOnTheScreen(),
    );
    expect(screen.queryByText('Back Squat')).not.toBeOnTheScreen();
  });
});


/**
 * "On today" — the rail of every class the gym runs today, which exists so a
 * member can see what's on without booking anything first. The peek sheet is
 * the point: a tile whose class carries a programmed workout shows the
 * whiteboard in place, and one without it has nothing to preview and simply
 * opens the class.
 */
describe('Home dashboard — On today rail', () => {
  it('peeks at the programmed workout without leaving Home', async () => {
    stageHome({
      sessions: [
        todaySession({
          workouts: [
            {
              id: 'w_class',
              title: 'Cindy',
              displayName: 'Cindy',
              description: '20 minutes AMRAP',
              scoring: 'rounds',
              mode: 'fixed',
              timeCap: 20,
              sortOrder: 0,
              sections: [],
            },
          ],
        }),
      ],
    });

    await renderWithProviders(<HomeScreen />);

    await userEvent.press(await screen.findByText('Yoga'));

    expect(await screen.findByText('Cindy')).toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalled();
  }, 15000);

  it('opens the class itself when nothing is programmed', async () => {
    stageHome({ sessions: [todaySession()] });

    await renderWithProviders(<HomeScreen />);

    await userEvent.press(await screen.findByText('Yoga'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/schedule/[id]',
        params: { id: 'sess_1' },
      }),
    );
  }, 15000);
});


/**
 * FIT-287 presale: the member paid at a gym that has not opened yet. Their
 * board is empty and their card is untouched, both correctly — the card is
 * what stops that reading as a purchase that silently failed.
 */
describe('Home dashboard — presale welcome', () => {
  /** `/users/me` with an opening day `days` from now, in `YYYY-MM-DD`. */
  function stagePreOpenGym(days: number) {
    const opensOn = new Intl.DateTimeFormat('en-CA').format(
      new Date(Date.now() + days * 86_400_000),
    );
    stageSignedInMember(
      userMe({
        memberships: [
          membership({
            organization: {
              id: TEST_ORG,
              name: 'Test Gym',
              opensOn,
            },
          } as never),
        ],
      }),
    );
    return opensOn;
  }

  it('welcomes a member whose purchase is waiting for opening day', async () => {
    stagePreOpenGym(12);
    stageHome({
      subscriptions: [
        subscriptionWithPlan({
          status: 'scheduled',
          nextChargeAt: new Date(
            Date.now() + 12 * 86_400_000,
          ).toISOString(),
        } as never),
      ],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(H.presaleTitle)).toBeOnTheScreen();
    expect(
      screen.getByText(H.presaleCountdown.replace('{days}', '12')),
    ).toBeOnTheScreen();
    // Nothing is programmed and nothing can be booked yet, so the open-day
    // nudge toward the week would be a second, worse answer to the same
    // question the card just answered.
    expect(screen.queryByText(H.openDayTitle)).not.toBeOnTheScreen();
  }, 15000);

  it('leaves the ordinary screen alone for a member who has not bought', async () => {
    stagePreOpenGym(12);
    stageHome({ subscriptions: [] });

    await renderWithProviders(<HomeScreen />);

    // The open-day card is the tell that the normal Today section rendered.
    expect(await screen.findByText(H.openDayTitle)).toBeOnTheScreen();
    expect(screen.queryByText(H.presaleTitle)).not.toBeOnTheScreen();
  }, 15000);

  it('says nothing once the gym has opened', async () => {
    stagePreOpenGym(-1);
    stageHome({
      subscriptions: [subscriptionWithPlan({ status: 'active' })],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(H.openDayTitle)).toBeOnTheScreen();
    expect(screen.queryByText(H.presaleTitle)).not.toBeOnTheScreen();
  }, 15000);
});
