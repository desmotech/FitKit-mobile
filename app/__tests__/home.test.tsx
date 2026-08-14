/**
 * Home dashboard — the member's landing screen. These tests pin the four
 * member-visible "Today" states: an assigned workout renders its name, an
 * assigned rest day shows the rest copy (never the open-day nudge), a failed
 * read shows the error card (never a misleading rest/open state), and staged
 * goals render their titles.
 *
 * Network staged via MSW; the real hooks, week math, and screen logic run.
 */
import { screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../(tabs)/index';
import { homeStringsFor } from '@/i18n/home-strings';
import { getWeekStartDay, weekStartFor, ymd } from '@/lib/week';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const H = homeStringsFor('he');

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
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
}: {
  assignments?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
} = {}) {
  const requestedWeekStarts: (string | null)[] = [];
  server.use(
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
      HttpResponse.json({ data: [] }),
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
    // With goals present the empty-state nudge must be gone.
    expect(screen.queryByText(H.noGoals)).not.toBeOnTheScreen();
  });

  it('nudges toward creating a first goal when none are active', async () => {
    stageHome({
      goals: [goal({ status: 'archived' })],
    });

    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText(H.noGoals)).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByText('Back Squat')).not.toBeOnTheScreen(),
    );
  });
});
