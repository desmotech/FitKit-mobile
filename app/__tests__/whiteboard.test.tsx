/**
 * Whiteboard — the weekly program list. These tests pin the member-visible
 * week states: a staged week renders today's workout card (fetched for the
 * he-locale Sunday-anchored week), an all-rest week shows the rest-day card
 * copy, an empty week shows the rest-day empty state, and a failed fetch
 * shows the program error state (never a misleading rest/empty state).
 *
 * Network staged via MSW; the real hooks, week math, and screen logic run.
 */
import { screen, waitFor } from '@testing-library/react-native';
import WhiteboardScreen from '../(tabs)/workouts/index';
import { whiteboardStringsFor } from '@/i18n/whiteboard-strings';
import { getWeekStartDay, parseYmdLocal, weekStartFor, ymd } from '@/lib/week';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const W = whiteboardStringsFor('he');

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

// The weekStart the app derives for the Hebrew locale (Sunday-anchored),
// computed with the same lib functions the screen uses.
const WEEK_START = weekStartFor(new Date(), getWeekStartDay('he'));
const TODAY = ymd(new Date());

/** The seven YYYY-MM-DD dates of the visible week. */
function weekDates(): string[] {
  const start = parseYmdLocal(WEEK_START);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return ymd(d);
  });
}

function workoutAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asg_1',
    date: TODAY,
    published: true,
    status: 'assigned',
    kind: 'workout',
    completedAt: null,
    workout: {
      id: 'w_1',
      title: 'Fran',
      displayName: 'Fran',
      description: '21-15-9\nThrusters\nPull-ups',
      scoring: 'time',
      mode: 'fixed',
      timeCap: null,
      sortOrder: 0,
      sections: [],
    },
    ...overrides,
  };
}

/** Stage every read the whiteboard + member header perform on mount. */
function stageWhiteboard(assignments: Record<string, unknown>[] = []) {
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
    // Member header chrome (unread badges).
    http.get(api(`/organizations/${TEST_ORG}/announcements/unread-count`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
      HttpResponse.json({ data: { conversations: [] } }),
    ),
  );
  return { requestedWeekStarts };
}

beforeEach(() => {
  stageSignedInMember();
});

describe('Whiteboard — week states', () => {
  it("renders today's workout card by name, fetched for the he-locale week", async () => {
    const { requestedWeekStarts } = stageWhiteboard([workoutAssignment()]);

    await renderWithProviders(<WhiteboardScreen />);

    expect(await screen.findByText('Fran')).toBeOnTheScreen();
    // Anchored the way the app anchors it for Hebrew (Sunday) — a
    // Monday-anchored request would miss Sunday's WOD.
    expect(requestedWeekStarts).toContain(WEEK_START);
    // A day with a workout is neither rest nor empty.
    expect(screen.queryByText(W.restDayTitle)).not.toBeOnTheScreen();
    expect(screen.queryByText(W.emptySubtitle)).not.toBeOnTheScreen();
  });

  it('shows the rest-day card copy when the coach assigned rest all week', async () => {
    stageWhiteboard(
      weekDates().map((date, i) => ({
        id: `asg_rest_${i}`,
        date,
        published: true,
        status: 'assigned',
        kind: 'rest',
        workout: null,
      })),
    );

    await renderWithProviders(<WhiteboardScreen />);

    expect(await screen.findByText(W.restDayTitle)).toBeOnTheScreen();
    expect(screen.getByText(W.restDaySubtitle)).toBeOnTheScreen();
    expect(screen.queryByText(W.errorTitle)).not.toBeOnTheScreen();
  });

  it('shows the empty rest-day state when nothing is assigned this week', async () => {
    stageWhiteboard([]);

    await renderWithProviders(<WhiteboardScreen />);

    // The empty state interpolates today's weekday name the same way the
    // screen does (he-locale long weekday of the selected date).
    const dayName = new Intl.DateTimeFormat('he', { weekday: 'long' }).format(
      new Date(TODAY),
    );
    // Re-query inside waitFor: the found node detaches if a sibling query
    // (header badge) settles between find and assert and remounts the row.
    await waitFor(() =>
      expect(
        screen.getByText(W.emptyTitle.replace('{day}', dayName)),
      ).toBeOnTheScreen(),
    );
    // With no workouts anywhere this week, the subtitle is the
    // none-this-week variant.
    expect(screen.getByText(W.emptyNoneThisWeek)).toBeOnTheScreen();
    expect(screen.queryByText(W.errorTitle)).not.toBeOnTheScreen();
  });

  it('shows the program error state when the week fetch fails — never the rest state', async () => {
    stageWhiteboard();
    server.use(
      // 401: fails fast by design (useApiQuery skips retries for it), so
      // the error card appears without waiting out the retry backoff.
      http.get(api(`/organizations/${TEST_ORG}/assignments/my-week`), () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );

    await renderWithProviders(<WhiteboardScreen />);

    expect(await screen.findByText(W.errorTitle)).toBeOnTheScreen();
    expect(screen.getByText(W.errorSubtitle)).toBeOnTheScreen();
    expect(screen.getByText(W.errorRetry)).toBeOnTheScreen();
    // A network failure must never masquerade as a rest day or empty week.
    await waitFor(() => {
      expect(screen.queryByText(W.restDayTitle)).not.toBeOnTheScreen();
      expect(screen.queryByText(W.emptySubtitle)).not.toBeOnTheScreen();
      expect(screen.queryByText(W.emptyNoneThisWeek)).not.toBeOnTheScreen();
    });
  });
});
